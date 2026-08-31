import { request } from './client'

export function getMyProjects() {
  return request('/api/projects/mine')
}
