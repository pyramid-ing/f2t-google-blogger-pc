import { api } from './apiClient'

export async function getBloggerBlogsFromServer() {
  const res = await api.get('/google-blogger/user/blogs')
  return res.data.blogs?.items || []
}
