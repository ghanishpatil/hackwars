/**
 * Container Manager
 *
 * Provisions team services from templates, stops/removes containers, injects flags.
 */

import { getDockerClient } from './dockerClient.js';

/**
 * Provision containers for one team from service templates.
 *
 * @param {string} matchId
 * @param {string} teamId — e.g. teamA or teamB
 * @param {string} networkId — Docker network ID or name for NetworkMode
 * @param {object[]} serviceTemplates — array of template docs (templateId, name, type, dockerImage, port, flagPath, healthCheck, environmentVars)
 * @returns {Promise<object[]>} ContainerInfo: { containerId, containerName, serviceType, templateId, teamId, containerIP, port, flagPath, healthCheck }
 */
export async function provisionTeamServices(matchId, teamId, networkId, serviceTemplates) {
  const docker = getDockerClient();
  const created = [];
  const networkNameOrId = networkId;

  try {
    for (const template of serviceTemplates) {
      const templateId = template.templateId || template.id;
      const serviceType = template.type || 'other';
      const containerName = `match-${matchId}-${teamId}-${serviceType}-${(templateId || '').slice(0, 8)}`;

      try {
        await docker.getImage(template.dockerImage).inspect();
      } catch {
        await new Promise((resolve, reject) => {
          docker.pull(template.dockerImage, (err, stream) => {
            if (err) return reject(err);
            docker.modem.followProgress(stream, (pullErr) => (pullErr ? reject(pullErr) : resolve()));
          });
        });
      }

      const env = template.environmentVars && typeof template.environmentVars === 'object'
        ? Object.entries(template.environmentVars).map(([k, v]) => `${k}=${String(v)}`)
        : [];
      const port = Number(template.port) || 80;

      const container = await docker.createContainer({
        Image: template.dockerImage,
        name: containerName,
        Env: env,
        ExposedPorts: { [`${port}/tcp`]: {} },
        HostConfig: {
          NetworkMode: networkNameOrId,
          Memory: 512 * 1024 * 1024,
          RestartPolicy: { Name: 'on-failure', MaximumRetryCount: 3 },
        },
        Labels: {
          'ctf.match.id': matchId,
          'ctf.team.id': teamId,
          'ctf.service.type': serviceType,
          'ctf.template.id': String(templateId || ''),
        },
      });

      await container.start();
      const inspect = await container.inspect();
      const netSettings = inspect.NetworkSettings?.Networks?.[networkNameOrId] || Object.values(inspect.NetworkSettings?.Networks || {})[0];
      const containerIP = netSettings?.IPAddress || '';

      const serviceId = `${teamId}_${templateId}`;
      created.push({
        containerId: container.id,
        containerName,
        serviceType,
        templateId,
        teamId,
        serviceId,
        containerIP,
        port,
        flagPath: template.flagPath || '/flag.txt',
        healthCheck: template.healthCheck || { type: 'http', endpoint: '/', expectedStatus: 200, interval: 30 },
      });
    }

    return created;
  } catch (err) {
    for (const c of created) {
      try {
        await stopAndRemoveContainer(c.containerId);
      } catch (e) {
        console.warn('Rollback: failed to remove container', c.containerId, e.message);
      }
    }
    throw err;
  }
}

/**
 * Stop and remove a container.
 *
 * @param {string} containerId
 */
export async function stopAndRemoveContainer(containerId) {
  const docker = getDockerClient();
  const container = docker.getContainer(containerId);
  try {
    await container.stop({ t: 10 });
  } catch (err) {
    if (err.statusCode !== 304) {
      // 304 = already stopped
    }
  }
  await container.remove({ force: true });
}

/**
 * Inject flag into container at path (exec echo into file).
 * Escapes flag value to prevent command injection.
 *
 * @param {string} containerId
 * @param {string} flagPath
 * @param {string} flagValue
 */
export async function injectFlagIntoContainer(containerId, flagPath, flagValue) {
  const docker = getDockerClient();
  const container = docker.getContainer(containerId);
  const escaped = String(flagValue).replace(/'/g, "'\\''").replace(/\\/g, '\\\\');
  const safePath = String(flagPath).replace(/[;&|$`]/g, '');
  const cmd = ['sh', '-c', `echo '${escaped}' > ${safePath}`];
  const exec = await container.exec({
    Cmd: cmd,
    AttachStdout: true,
    AttachStderr: true,
  });
  const stream = await exec.start({ Detach: false });
  await new Promise((resolve, reject) => {
    stream.on('end', resolve);
    stream.on('error', reject);
    stream.resume();
  });
  const inspect = await exec.inspect();
  if (inspect.ExitCode !== 0) {
    throw new Error(`Flag injection failed with exit code ${inspect.ExitCode}`);
  }
}
