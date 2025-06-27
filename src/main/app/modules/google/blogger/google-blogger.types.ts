export interface BloggerOptions {
  blogId?: string
  blogUrl?: string
  maxResults?: number
  pageToken?: string
  status?: 'live' | 'draft' | 'scheduled'
}

export interface BloggerPost {
  id: string
  title: string
  content: string
  url: string
  published: string
  updated: string
  author: {
    id: string
    displayName: string
  }
  labels?: string[]
  status: string
}
