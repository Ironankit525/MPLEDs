import { request } from './client.js'

export function getMyProjects() {
  return request('/api/projects/mine')
}
