<script setup lang="ts">
import { nextTick, ref } from 'vue'

const props = defineProps<{
  value: number | null
  label: '卷' | '話'
}>()

const emit = defineEmits<{
  update: [value: number | null]
}>()

const editing = ref(false)
const inputRef = ref<HTMLInputElement | null>(null)
// 編輯中的值。v-model 在 type="number" input 上會自動把字串 cast 成 number,
// 所以 draft 可能是 string('') 或 number。
const draft = ref<string | number>('')
// 樂觀更新:UI 立刻反映,失敗時靠這個還原
const optimisticValue = ref<number | null>(null)
const useOptimistic = ref(false)

// 顯示用的值:優先用樂觀值,其次 props
function displayValue(): number | null {
  return useOptimistic.value ? optimisticValue.value : props.value
}

async function startEdit() {
  draft.value = props.value === null ? '' : String(props.value)
  editing.value = true
  await nextTick()
  inputRef.value?.focus()
  inputRef.value?.select()
}

function cancel() {
  editing.value = false
  draft.value = ''
}

async function commit() {
  if (!editing.value) return

  // v-model 在 <input type="number"> 上會把 draft 自動 cast 成 number,
  // 直接 .trim() 會 TypeError。先 String() 轉成字串再處理。
  const trimmed = String(draft.value ?? '').trim()
  let next: number | null

  if (trimmed === '') {
    next = null
  } else {
    const n = Number(trimmed)
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
      // 不合法輸入,當成取消
      cancel()
      return
    }
    next = n
  }

  // 沒變就不送
  if (next === props.value) {
    cancel()
    return
  }

  // 樂觀更新:UI 立刻變
  optimisticValue.value = next
  useOptimistic.value = true
  editing.value = false

  try {
    emit('update', next)
    // 階段 1 emit 是同步的,這裡保留 try/catch 為日後 async 鋪路
  } catch {
    // 失敗回滾
    useOptimistic.value = false
  } finally {
    // props 更新後關掉樂觀模式
    // 這裡簡化處理:下個 tick 關掉,讓父層更新後再讀 props
    nextTick(() => {
      useOptimistic.value = false
    })
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    commit()
  } else if (e.key === 'Escape') {
    e.preventDefault()
    cancel()
  }
}
</script>

<template>
  <span v-if="editing">
    <input
      ref="inputRef"
      v-model="draft"
      type="number"
      inputmode="numeric"
      min="0"
      class="h-7 w-16 rounded border border-blue-400 bg-white px-1.5 text-[13px] font-medium text-neutral-900 outline-none focus:ring-2 focus:ring-blue-200"
      @keydown="onKeydown"
      @blur="commit"
    />
  </span>
  <span
    v-else-if="displayValue() !== null"
    class="cursor-text rounded bg-neutral-100 px-1.5 py-0.5 font-medium text-neutral-900 hover:bg-neutral-200"
    :title="`點擊編輯${label}`"
    @click="startEdit"
  >
    {{ displayValue() }}
  </span>
  <span
    v-else
    class="cursor-text px-1.5 py-0.5 text-neutral-400 hover:text-neutral-600"
    :title="`點擊填入${label}`"
    @click="startEdit"
  >
    —
  </span>
</template>
