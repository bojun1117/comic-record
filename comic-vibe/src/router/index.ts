import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import HomeView from '@/views/HomeView.vue'
import LoginView from '@/views/LoginView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: LoginView,
      meta: { public: true },
    },
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
  ],
})

router.beforeEach((to) => {
  const auth = useAuthStore()

  // 已登入又跳到 login → 直接回首頁
  if (to.name === 'login' && auth.isAuthenticated) {
    return { name: 'home' }
  }

  // 不需要登入的頁面(目前只有 login)→ 放行
  if (to.meta.public) return true

  // 需要登入但沒 token → 踢去 login,記下原本想去的地方
  if (!auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  return true
})

export default router
