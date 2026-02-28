/**
 * GitHub Storage Service
 * Uses GitHub API to store and retrieve JSON data from a repository.
 */

export interface GitHubConfig {
  token: string;
  repo: string;
  path: string;
  branch: string;
}

export class GitHubStorage {
  private config: GitHubConfig;

  constructor(config: GitHubConfig) {
    this.config = config;
  }

  private async getFile() {
    const { token, repo, path, branch } = this.config;
    const url = `https://api.github.com/repos/${repo}/contents/${path}?ref=${branch}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.statusText}`);
    }

    return await response.json();
  }

  async loadData<T>(defaultValue: T): Promise<T> {
    try {
      const file = await this.getFile();
      if (!file) return defaultValue;
      
      const content = atob(file.content);
      return JSON.parse(content);
    } catch (error) {
      console.error('Error loading from GitHub:', error);
      return defaultValue;
    }
  }

  async saveData<T>(data: T): Promise<void> {
    const { token, repo, path, branch } = this.config;
    const url = `https://api.github.com/repos/${repo}/contents/${path}`;
    
    const existingFile = await this.getFile();
    const sha = existingFile?.sha;
    
    const content = btoa(JSON.stringify(data, null, 2));
    
    const body: any = {
      message: 'Update Remindly data',
      content,
      branch
    };
    
    if (sha) {
      body.sha = sha;
    }

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(`GitHub Save Error: ${err.message || response.statusText}`);
    }
  }
}

/**
 * LocalStorage Fallback Service
 */
export const LocalStorageService = {
  load: <T>(key: string, defaultValue: T): T => {
    const saved = localStorage.getItem(key);
    if (!saved) return defaultValue;
    try {
      return JSON.parse(saved);
    } catch {
      return defaultValue;
    }
  },
  save: <T>(key: string, data: T): void => {
    localStorage.setItem(key, JSON.stringify(data));
  }
};
