<template>
  <div class="mcq-option-status-label shrink-0 flex items-center justify-end text-xs font-semibold select-none pl-2">
    <!-- Case 1: Student answer AND correct -->
    <span
      v-if="type === 'student-correct'"
      class="inline-flex items-center gap-1.5 text-success whitespace-nowrap"
    >
      <svg
        class="w-4 h-4 shrink-0"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
      </svg>
      <span>Your answer, correct</span>
    </span>

    <!-- Case 2: Student answer AND wrong -->
    <span
      v-else-if="type === 'student-wrong'"
      class="inline-flex items-center gap-1.5 text-danger whitespace-nowrap"
    >
      <span>Your answer</span>
    </span>

    <!-- Case 3: Correct answer (Mentor or Student who was wrong/did not answer) -->
    <span
      v-else-if="type === 'correct'"
      class="inline-flex items-center gap-1.5 text-success whitespace-nowrap"
    >
      <svg
        class="w-4 h-4 shrink-0"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
      </svg>
      <span>Correct answer</span>
    </span>
  </div>
</template>

<script setup>
defineProps({
  type: {
    type: String,
    required: true,
    validator: (val) => ['correct', 'student-correct', 'student-wrong'].includes(val)
  }
})
</script>
