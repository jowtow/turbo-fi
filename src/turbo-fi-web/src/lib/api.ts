import type {
  DeletePath,
  DeleteResponse,
  FormPath,
  FormResponse,
  GetPath,
  GetResponse,
  PostBody,
  PostPath,
  PostResponse,
  PutBody,
  PutPath,
  PutResponse,
} from './api-contract'

class ApiService {
  async get<Path extends GetPath>(path: Path): Promise<GetResponse<Path>> {
    return this.request(path, { method: 'GET' })
  }

  async post<Path extends PostPath>(path: Path, body?: PostBody<Path>): Promise<PostResponse<Path>> {
    return this.request(path, {
      method: 'POST',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  }

  async put<Path extends PutPath>(path: Path, body: PutBody<Path>): Promise<PutResponse<Path>> {
    return this.request(path, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  async delete<Path extends DeletePath>(path: Path): Promise<DeleteResponse<Path>> {
    return this.request(path, { method: 'DELETE' })
  }

  async form<Path extends FormPath>(path: Path, body: FormData): Promise<FormResponse<Path>> {
    const response = await fetch(`/api${path}`, { method: 'POST', credentials: 'include', body })
    const responseBody = await response.text()
    if (!response.ok && response.status !== 409) throw new Error(responseBody || 'Import failed.')
    try {
      return JSON.parse(responseBody) as FormResponse<Path>
    } catch {
      throw new Error('The import response could not be read.')
    }
  }

  private async request<Response>(path: string, init: RequestInit): Promise<Response> {
    const response = await fetch(`/api${path}`, { credentials: 'include', ...init })
    if (!response.ok) throw new Error(await response.text() || 'Something went wrong.')
    return response.status === 204 ? undefined as Response : response.json() as Promise<Response>
  }
}

export const api = new ApiService()
