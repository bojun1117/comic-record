import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { loginApi } from '@/api/auth'

const TOKEN_STORAGE_KEY = 'comic-vibe.token'

function readStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY)
  } catch {
    return null
  }
}

function writeStoredToken(token: string | null): void {
  try {
    if (token === null) {
      localStorage.removeItem(TOKEN_STORAGE_KEY)
    } else {
      localStorage.setItem(TOKEN_STORAGE_KEY, token)
    }
  } catch {
    // localStorage 不能用(隱私瀏覽 / 配額爆) → 退回記憶體
  }
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(readStoredToken())

  const isAuthenticated = computed(() => token.value !== null)

  async function login(password: string): Promise<void> {
    const res = await loginApi(password)
    token.value = res.token
    writeStoredToken(res.token)
  }

  function logout(): void {
    token.value = null
    writeStoredToken(null)
  }

  // 給其他 store / API 客戶端用
  function getToken(): string | null {
    return token.value
  }

  return {
    token,
    isAuthenticated,
    login,
    logout,
    getToken,
  }
})
