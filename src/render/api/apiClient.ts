import axios from 'axios'

const API_BASE_URL = 'http://localhost:3554'

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})
