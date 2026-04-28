<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    message: string | null
    durationMs?: number
    variant?: 'error' | 'info'
  }>(),
  { durationMs: 4000, variant: 'error' },
)

const emit = defineEmits<{
  dismiss: []
}>()

const visible = ref(false)
let timer: number | null = null

function show() {
  visible.value = true
  if (timer !== null) {
    window.clearTimeout(timer)
  }
  timer = window.setTimeout(() => {
    visible.value = false
    emit('dismiss')
  }, props.durationMs)
}

watch(
  () => props.message,
  (msg) => {
    if (msg) show()
    else visible.value = false
  },
)

onMounted(() => {
  if (props.message) show()
})

onUnmounted(() => {
  if (timer !== null) window.clearTimeout(timer)
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible && message"
      class="pointer-events-none fixed inset-x-0 bottom-6 z-[100] flex justify-center px-4"
    >
      <div
        class="pointer-events-auto rounded-md px-4 py-2 text-sm shadow-lg"
        :class="
          variant === 'error'
            ? 'bg-red-600 text-white'
            : 'bg-neutral-900 text-white'
        "
      >
        {{ message }}
      </div>
    </div>
  </Teleport>
</template>
