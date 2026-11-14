<template>
  <div class="practice-host w-full h-full flex items-center justify-center min-h-0 relative select-text">
    <component
      :is="component"
      :key="instanceKey"
      v-bind="stepProps"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'

defineProps({
  component: {
    type: [Object, Function],
    required: true
  },
  stepProps: {
    type: Object,
    default: () => ({})
  }
})

const instanceKey = ref(0)
</script>
