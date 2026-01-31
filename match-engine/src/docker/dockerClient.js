/**
 * Docker Client
 * 
 * Initializes Docker client using dockerode.
 * Handles Docker operations for container lifecycle management.
 * 
 * Note: Docker client is initialized but no containers are created yet.
 * This is foundation only.
 */

import Docker from 'dockerode';

let dockerClient = null;

/**
 * Initialize Docker client
 * 
 * @returns {Docker} Docker client instance
 */
export function getDockerClient() {
  if (dockerClient) {
    return dockerClient;
  }

  try {
    // Initialize Docker client
    // On Windows, this will connect to Docker Desktop
    // On Linux, this connects to the Docker daemon socket
    dockerClient = new Docker();
    
    console.log('Docker client initialized');
    return dockerClient;
  } catch (error) {
    console.error('Failed to initialize Docker client:', error);
    throw error;
  }
}

/**
 * Test Docker connection
 * 
 * @returns {Promise<boolean>} True if Docker is accessible
 */
export async function testDockerConnection() {
  try {
    const docker = getDockerClient();
    await docker.ping();
    return true;
  } catch (error) {
    console.error('Docker connection test failed:', error);
    return false;
  }
}
