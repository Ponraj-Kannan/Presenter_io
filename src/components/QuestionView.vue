<template>
  <div
    :class="[
      'question-view-wrapper w-full flex flex-col max-w-5xl mx-auto p-1 sm:p-2',
      isMentor ? 'h-full justify-center' : 'justify-start'
    ]"
  >
    <!-- STUDENT VIEW (Compact, Top-Aligned with Fixed 1.5rem Top Padding) -->
    <div v-if="!isMentor" class="question-view-student w-full max-w-2xl mx-auto flex flex-col justify-start pt-6 relative">
      <!-- Overlay Alert Banner (positioned absolutely, never moves the question) -->
      <transition name="fade">
        <div
          v-if="visibleStudentAlert"
          role="alert"
          class="student-question-alert absolute top-0 left-0 right-0 z-20 flex items-center justify-between gap-3 rounded-xl border border-warning/40 bg-warning-soft px-3.5 py-2 text-xs sm:text-sm text-warning shadow-card"
        >
          <div class="flex items-center gap-2 min-w-0">
            <span class="w-2 h-2 rounded-full bg-warning shrink-0"></span>
            <span class="font-medium truncate sm:whitespace-normal">{{ visibleStudentAlert.message }}</span>
          </div>
          <button
            type="button"
            @click="dismissStudentAlert"
            class="btn-secondary px-2.5 py-0.5 rounded-md font-semibold text-[11px] shrink-0 transition cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      </transition>

      <!-- Header Pills -->
      <div class="flex items-center gap-2 mb-2">
        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full bg-raised text-primary border border-border font-medium text-xs">
          Question {{ questionNumber }} / {{ totalQuestions }}
        </span>
        <span
          v-if="!isRevealed"
          class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-accent-soft text-accent font-medium text-xs"
        >
          <span class="w-1.5 h-1.5 rounded-full bg-accent animate-pulse"></span>
          MCQ Active
        </span>
        <span
          v-else
          class="inline-flex items-center px-2.5 py-0.5 rounded-full bg-raised text-secondary font-medium text-xs"
        >
          Answer revealed
        </span>
      </div>

      <!-- Question Text (Semibold 600 weight) -->
      <h2 class="text-sm sm:text-base md:text-lg font-semibold text-primary leading-snug mb-3">
        {{ questionData.question }}
      </h2>

      <!-- Options List -->
      <div class="space-y-2">
        <button
          v-for="opt in questionData.options"
          :key="getOptionId(opt)"
          type="button"
          :disabled="isRevealed || isSessionEnded"
          @click="selectOption(getOptionId(opt))"
          :class="[
            'mcq-option-row w-full p-2.5 sm:p-3 rounded-xl border text-left font-medium flex items-center justify-between gap-3 transition text-xs sm:text-sm min-h-[46px] sm:min-h-[50px]',
            getStudentOptionClass(opt)
          ]"
        >
          <!-- Left Side: Option Letter Badge & Regular Weight Text -->
          <div class="flex items-center gap-3 min-w-0 flex-1">
            <span
              :class="[
                'w-6 h-6 rounded-full font-bold text-xs flex items-center justify-center shrink-0 transition',
                getStudentOptionBadgeClass(opt)
              ]"
            >
              <svg
                v-if="isOptionSelected(opt) && !isRevealed"
                class="w-3.5 h-3.5 text-on-accent"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <template v-else>
                {{ opt.label || getOptionId(opt) }}
              </template>
            </span>

            <span class="flex-1 min-w-0 break-words sm:whitespace-normal text-primary font-normal leading-snug">
              {{ opt.text }}
            </span>
          </div>

          <!-- Right Side Status Label (Visible after reveal) -->
          <MCQOptionLabel
            v-if="isRevealed && isStudentOption(opt) && isOptionCorrect(opt)"
            type="student-correct"
          />
          <MCQOptionLabel
            v-else-if="isRevealed && isStudentOption(opt) && !isOptionCorrect(opt)"
            type="student-wrong"
          />
          <MCQOptionLabel
            v-else-if="isRevealed && isOptionCorrect(opt)"
            type="correct"
          />
        </button>
      </div>

      <!-- Action Row (one compact row with fixed minimum height, never changes size) -->
      <div v-if="!isRevealed" class="action-row mt-3 min-h-[44px] flex items-center justify-between gap-3 select-none">
        <!-- Left Side: Status Line -->
        <div class="flex-1 min-w-0 flex items-center">
          <div
            v-if="hasSubmitted"
            class="flex items-center gap-1.5 text-xs text-muted leading-snug"
          >
            <svg class="w-4 h-4 text-accent shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <span class="truncate sm:whitespace-normal">
              Answer submitted. You can change it until the Mentor shows the correct answer.
            </span>
          </div>
        </div>

        <!-- Right Side: Button -->
        <div class="shrink-0 flex items-center justify-end">
          <!-- 1. Nothing selected: Primary button "Submit", disabled -->
          <button
            v-if="!localSelectedOption"
            type="button"
            disabled
            class="btn-primary min-w-[9rem] py-2 px-4 rounded-xl text-xs sm:text-sm font-semibold transition"
          >
            Submit
          </button>

          <!-- 2. Option selected, nothing submitted: Primary "Submit" -->
          <button
            v-else-if="!hasSubmitted"
            type="button"
            @click="handleSubmit"
            class="btn-primary min-w-[9rem] py-2 px-4 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer active:scale-98"
          >
            Submit
          </button>

          <!-- 3. Selected option differs from submitted answer: Primary "Update Answer" -->
          <button
            v-else-if="localSelectedOption !== submittedAnswer"
            type="button"
            @click="handleSubmit"
            class="btn-primary min-w-[9rem] py-2 px-4 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer active:scale-98"
          >
            Update Answer
          </button>

          <!-- 4. Selected option matches submitted answer: no button (only status line on left) -->
        </div>
      </div>

      <!-- Visually Hidden Announcement for Screen Readers (no visible box or gap) -->
      <div
        v-if="isRevealed"
        role="status"
        aria-live="polite"
        class="sr-only"
      >
        {{ srResultMessage }}
      </div>
    </div>

    <!-- MENTOR VIEW (Two columns, compact) -->
    <div v-else class="w-full grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
      <!-- Left Column: Question & Controls (7 of 12) -->
      <div class="lg:col-span-7 flex flex-col">
        <!-- Badges -->
        <div class="flex items-center gap-2 mb-2">
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full bg-raised text-primary border border-border font-semibold text-xs">
            Question {{ questionNumber }} / {{ totalQuestions }}
          </span>
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full bg-raised text-secondary border border-border font-medium text-xs">
            {{ questionData.topic }}
          </span>
        </div>

        <!-- Question Text -->
        <h2 class="text-sm sm:text-base md:text-lg font-bold text-primary leading-snug mb-3">
          {{ questionData.question }}
        </h2>

        <!-- Options List -->
        <div class="space-y-2 mb-3">
          <div
            v-for="opt in questionData.options"
            :key="opt.label"
            :class="[
              'w-full p-2.5 sm:p-3 rounded-xl border font-medium flex items-center justify-between gap-3 transition text-xs sm:text-sm min-h-[46px] sm:min-h-[50px]',
              getMentorOptionClass(opt.label)
            ]"
          >
            <!-- Left Side: Option Letter Badge & Text -->
            <div class="flex items-center gap-3 min-w-0 flex-1">
              <span
                :class="[
                  'w-6 h-6 rounded-full font-bold text-xs flex items-center justify-center shrink-0 transition',
                  getMentorOptionBadgeClass(opt.label)
                ]"
              >
                {{ opt.label }}
              </span>
              <span class="flex-1 min-w-0 break-words sm:whitespace-normal leading-snug">
                {{ opt.text }}
              </span>
            </div>

            <!-- Right Side Status Label (Visible after reveal on correct option only) -->
            <MCQOptionLabel
              v-if="isRevealed && isMentorOptionCorrect(opt.label)"
              type="correct"
            />
          </div>
        </div>

        <!-- Mentor Action Buttons (Inline & Compact) -->
        <div class="flex flex-wrap items-center gap-2.5 pt-1">
          <button
            v-if="!isRevealed"
            type="button"
            @click="emitReveal"
            class="btn-tonal-success px-3.5 py-1.5 rounded-lg font-semibold text-xs transition cursor-pointer"
          >
            Show Correct Answer
          </button>
          <button
            v-else
            type="button"
            disabled
            class="btn-secondary px-3.5 py-1.5 rounded-lg font-medium text-xs cursor-default opacity-60"
          >
            Answer Revealed
          </button>

          <button
            type="button"
            @click="emitNext"
            :disabled="!isRevealed"
            class="btn-tonal-admin px-3.5 py-1.5 rounded-lg font-semibold text-xs transition cursor-pointer flex items-center gap-1.5"
          >
            <span>Next Question</span>
            <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <div class="flex items-center gap-2 sm:ml-auto sm:pl-2.5 sm:border-l sm:border-border">
            <button
              type="button"
              @click="emitAlert"
              :disabled="isAlertDisabled"
              class="btn-tonal-warning px-3 py-1.5 rounded-lg font-semibold text-xs transition cursor-pointer"
            >
              {{ alertCooldownSeconds > 0 ? `Alert (${alertCooldownSeconds}s)` : 'Alert' }}
            </button>
            <span class="text-xs text-secondary font-medium whitespace-nowrap">
              {{ unansweredCountText }}
            </span>
          </div>
        </div>
      </div>

      <!-- Right Column: Live Responses Card (5 of 12) -->
      <div class="lg:col-span-5 bg-card border border-border rounded-xl p-3 sm:p-4">
        <h3 class="text-[11px] font-bold text-muted uppercase tracking-wider mb-2.5">
          Live Responses
        </h3>

        <!-- 3 Stat Tiles -->
        <div class="grid grid-cols-3 gap-2 mb-3">
          <div class="bg-raised rounded-lg p-2 border border-border text-center">
            <div class="text-xl font-bold text-accent">
              {{ activeStudentsCount }}
            </div>
            <div class="text-[10px] text-secondary font-medium">Active</div>
          </div>

          <div class="bg-raised rounded-lg p-2 border border-border text-center">
            <div class="text-xl font-bold text-success">
              {{ correctCount }}
            </div>
            <div class="text-[10px] text-secondary font-medium">Correct</div>
          </div>

          <div class="bg-raised rounded-lg p-2 border border-border text-center">
            <div class="text-xl font-bold text-danger">
              {{ incorrectCount }}
            </div>
            <div class="text-[10px] text-secondary font-medium">Incorrect</div>
          </div>
        </div>

        <!-- Progress Bar -->
        <div class="mb-3">
          <div class="flex items-center justify-between text-[11px] text-secondary font-medium mb-1">
            <span>Answered {{ answeredCount }}</span>
            <span>
              {{ progressPercentage }}%
            </span>
          </div>
          <div class="w-full bg-raised rounded-full h-1.5 overflow-hidden border border-border">
            <div
              class="bg-accent h-full rounded-full transition-all duration-300"
              :style="{ width: progressPercentage + '%' }"
            ></div>
          </div>
        </div>

        <!-- Student Responses List (Compact with scrollbar if long) -->
        <div class="border-t border-border pt-2.5">
          <div class="text-[11px] font-semibold text-secondary mb-2">
            Participants ({{ studentResponsesList.length }})
          </div>

          <div
            v-if="studentResponsesList.length === 0"
            class="text-[11px] text-muted italic text-center py-3 bg-raised/40 rounded-lg border border-dashed border-border"
          >
            Waiting for student responses...
          </div>

          <div v-else class="space-y-1.5 max-h-36 overflow-y-auto pr-1">
            <div
              v-for="st in studentResponsesList"
              :key="st.studentKey"
              class="flex items-center justify-between bg-raised px-2.5 py-1.5 rounded-lg border border-border text-xs"
            >
              <div class="flex items-center gap-1.5 min-w-0">
                <span class="font-medium text-primary truncate max-w-[120px]" :title="st.studentName">
                  {{ st.studentName }}
                </span>
                <span
                  v-if="st.hasLeft"
                  class="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-panel text-muted border border-border shrink-0"
                >
                  Left
                </span>
              </div>

              <div class="flex items-center gap-1.5">
                <span
                  v-if="st.hasChanged"
                  class="px-1.5 py-0.5 rounded text-[10px] font-medium bg-panel text-secondary border border-border"
                >
                  Changed
                </span>

                <span v-if="st.selectedOption" class="font-bold text-primary text-xs">
                  {{ st.selectedOption }}
                </span>

                <span
                  v-if="!st.selectedOption"
                  class="px-2 py-0.5 rounded-full bg-panel text-muted border border-border-strong font-medium text-[10px]"
                >
                  Waiting
                </span>
                <span
                  v-else-if="st.isCorrect"
                  class="px-2 py-0.5 rounded-full bg-success-soft text-success border border-success font-semibold text-[10px]"
                >
                  Correct
                </span>
                <span
                  v-else
                  class="px-2 py-0.5 rounded-full bg-danger-soft text-danger border border-danger font-semibold text-[10px]"
                >
                  Incorrect
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, inject, ref, watch } from 'vue'
import MCQOptionLabel from './MCQOptionLabel.vue'

const mcqAlertContext = inject('mcqAlertContext', null)
const getStepItemMeta = inject('getStepItemMeta', null)
const stepFlowHost = inject('stepFlowHost', null)

const props = defineProps({
  questionData: {
    type: Object,
    required: true
  },
  questionNumber: {
    type: Number,
    default: 1
  },
  totalQuestions: {
    type: Number,
    default: 3
  },
  isMentor: {
    type: Boolean,
    default: false
  },
  studentName: {
    type: String,
    default: ''
  },
  studentAnswers: {
    type: Object,
    default: () => ({})
  },
  allResponses: {
    type: Object,
    default: () => ({})
  },
  activeStudents: {
    type: Array,
    default: () => []
  },
  isRevealed: {
    type: Boolean,
    default: false
  },
  isClassEnded: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['submit-answer', 'reveal-answer', 'next-question'])

const isSessionEnded = computed(() => props.isClassEnded || Boolean(stepFlowHost?.isClassEnded?.value))

const currentStepMeta = typeof getStepItemMeta === 'function' ? getStepItemMeta() : null
const effectiveQuestionId = computed(() => {
  const meta = typeof getStepItemMeta === 'function' ? getStepItemMeta() : currentStepMeta
  return meta?.stepQuestionKey || props.questionData?.id || `step_${props.questionNumber}`
})

watch(
  () => props.questionData,
  (qData) => {
    const meta = typeof getStepItemMeta === 'function' ? getStepItemMeta() : currentStepMeta
    if (qData && typeof meta?.reportQuestionData === 'function') {
      meta.reportQuestionData(qData)
    }
  },
  { immediate: true }
)

// --- Option ID and Correctness Resolution ---
function getOptionId(opt) {
  if (!opt) return ''
  if (typeof opt === 'string' || typeof opt === 'number') return String(opt).trim()
  if (opt.id !== undefined && opt.id !== null) return String(opt.id).trim()
  if (opt.label !== undefined && opt.label !== null) return String(opt.label).trim()
  if (opt.value !== undefined && opt.value !== null) return String(opt.value).trim()
  return ''
}

function getCorrectOptionId(qData) {
  if (!qData) return ''
  if (qData.correctOptionId !== undefined && qData.correctOptionId !== null) {
    return String(qData.correctOptionId).trim()
  }
  if (qData.correctAnswer !== undefined && qData.correctAnswer !== null) {
    return String(qData.correctAnswer).trim()
  }
  if (qData.correctOption !== undefined && qData.correctOption !== null) {
    return String(qData.correctOption).trim()
  }
  return ''
}

function formatOptionFullText(opt) {
  if (!opt) return ''
  const label = opt.label || opt.id || ''
  const text = opt.text || ''
  if (label && text) return `${label}, ${text}`
  return text || label || ''
}

// --- Student Logic ---
const submittedAnswer = computed(() => {
  return props.studentAnswers[effectiveQuestionId.value]?.selectedOption || null
})

const hasSubmitted = computed(() => {
  return Boolean(submittedAnswer.value)
})

const studentSelectedOptionId = computed(() => {
  const ans = submittedAnswer.value
  if (!ans) return ''
  return String(ans).trim()
})

const correctOptionId = computed(() => {
  return getCorrectOptionId(props.questionData)
})

const isStudentCorrect = computed(() => {
  if (!hasSubmitted.value || !studentSelectedOptionId.value || !correctOptionId.value) return false
  return studentSelectedOptionId.value === correctOptionId.value
})

function isOptionCorrect(opt) {
  const oId = getOptionId(opt)
  const cId = correctOptionId.value
  return Boolean(oId && cId && oId === cId)
}

function isStudentOption(opt) {
  if (!hasSubmitted.value || !studentSelectedOptionId.value) return false
  const oId = getOptionId(opt)
  return Boolean(oId && oId === studentSelectedOptionId.value)
}

const studentSelectedOptionObj = computed(() => {
  if (!hasSubmitted.value || !studentSelectedOptionId.value) return null
  return (props.questionData.options || []).find(
    (opt) => getOptionId(opt) === studentSelectedOptionId.value
  ) || null
})

const correctOptionObj = computed(() => {
  if (!correctOptionId.value) return null
  return (props.questionData.options || []).find(
    (opt) => getOptionId(opt) === correctOptionId.value
  ) || null
})

const localSelectedOption = ref(submittedAnswer.value)

watch(
  () => [effectiveQuestionId.value, submittedAnswer.value],
  ([newQId, newAns], [oldQId] = []) => {
    if (newQId !== oldQId) {
      localSelectedOption.value = newAns
    } else if (newAns && !localSelectedOption.value) {
      localSelectedOption.value = newAns
    }
  },
  { immediate: true }
)

watch(
  () => props.isRevealed || isSessionEnded.value,
  (locked) => {
    if (locked) {
      localSelectedOption.value = submittedAnswer.value
    }
  }
)

function selectOption(labelOrId) {
  if (props.isRevealed || isSessionEnded.value) return
  localSelectedOption.value = labelOrId
  dismissStudentAlert()
}

function isOptionSelected(opt) {
  const optId = getOptionId(opt)
  return optId === localSelectedOption.value
}

const submitButtonText = computed(() => {
  if (props.isRevealed || isSessionEnded.value) {
    return hasSubmitted.value ? 'Answer Submitted' : 'Submit'
  }
  if (!hasSubmitted.value) {
    return 'Submit'
  }
  if (localSelectedOption.value !== submittedAnswer.value) {
    return 'Update Answer'
  }
  return 'Answer Submitted'
})

const isSubmitDisabled = computed(() => {
  if (props.isRevealed || isSessionEnded.value) return true
  if (!localSelectedOption.value) return true
  if (hasSubmitted.value && localSelectedOption.value === submittedAnswer.value) return true
  return false
})

function handleSubmit() {
  if (isSubmitDisabled.value || props.isRevealed || isSessionEnded.value) return
  if (!localSelectedOption.value) return
  const isCorrect = localSelectedOption.value === correctOptionId.value
  emit('submit-answer', {
    questionId: effectiveQuestionId.value,
    selectedOption: localSelectedOption.value,
    isCorrect,
    timestamp: Date.now(),
    version: Date.now()
  })
}

function getStudentOptionClass(opt) {
  const optId = getOptionId(opt)
  const isCorrect = isOptionCorrect(opt)
  const isStudent = isStudentOption(opt)

  if (props.isRevealed || isSessionEnded.value) {
    if (isCorrect) {
      return 'mcq-option-highlight-success text-primary cursor-default'
    }
    if (isStudent && !isCorrect) {
      return 'mcq-option-highlight-danger text-primary cursor-default'
    }
    return 'border-border bg-card text-muted cursor-default'
  }

  if (optId === localSelectedOption.value) {
    return 'border-accent bg-accent-soft text-primary cursor-pointer'
  }

  return 'border-border hover:border-border-strong bg-card hover:bg-raised text-primary cursor-pointer'
}

function getStudentOptionBadgeClass(opt) {
  const optId = getOptionId(opt)
  const isCorrect = isOptionCorrect(opt)
  const isStudent = isStudentOption(opt)

  if (props.isRevealed || isSessionEnded.value) {
    if (isCorrect) {
      return 'bg-success text-on-accent font-bold'
    }
    if (isStudent && !isCorrect) {
      return 'bg-danger text-on-accent font-bold'
    }
    return 'bg-raised text-secondary font-bold'
  }

  if (optId === localSelectedOption.value) {
    return 'bg-accent text-on-accent font-bold'
  }

  return 'bg-raised text-secondary font-bold'
}

const resultMessageTitle = computed(() => {
  if (isStudentCorrect.value) return 'Correct'
  if (hasSubmitted.value) return 'Incorrect'
  return 'No answer submitted'
})

const resultMessageDetail = computed(() => {
  const studentFormatted = studentSelectedOptionObj.value
    ? formatOptionFullText(studentSelectedOptionObj.value)
    : (submittedAnswer.value ? String(submittedAnswer.value).trim() : '')
  const correctFormatted = correctOptionObj.value
    ? formatOptionFullText(correctOptionObj.value)
    : (correctOptionId.value ? String(correctOptionId.value).trim() : '')

  if (isStudentCorrect.value) {
    return `You answered ${studentFormatted}.`
  }
  if (hasSubmitted.value) {
    return `You answered ${studentFormatted}. The correct answer is ${correctFormatted}.`
  }
  return `The correct answer is ${correctFormatted}.`
})

const srResultMessage = computed(() => {
  if (!props.isRevealed) return ''
  return `${resultMessageTitle.value}. ${resultMessageDetail.value}`
})

// --- Mentor Logic ---
function emitReveal() {
  emit('reveal-answer', { questionId: effectiveQuestionId.value })
}

function emitNext() {
  emit('next-question', { questionId: effectiveQuestionId.value })
}

function isMentorOptionCorrect(labelOrOpt) {
  const label = typeof labelOrOpt === 'object' && labelOrOpt !== null
    ? getOptionId(labelOrOpt)
    : String(labelOrOpt).trim()
  return Boolean(correctOptionId.value && label === correctOptionId.value)
}

function getMentorOptionClass(opt) {
  const label = typeof opt === 'object' && opt !== null ? getOptionId(opt) : String(opt).trim()
  const correct = correctOptionId.value
  if (props.isRevealed) {
    if (label === correct) {
      return 'mcq-option-highlight-success text-primary font-semibold'
    }
    return 'border border-border bg-card text-muted'
  }
  return 'border border-border-strong bg-card text-primary'
}

function getMentorOptionBadgeClass(opt) {
  const label = typeof opt === 'object' && opt !== null ? getOptionId(opt) : String(opt).trim()
  const correct = correctOptionId.value
  if (props.isRevealed && label === correct) {
    return 'bg-success text-on-accent font-bold'
  }
  return 'bg-raised text-secondary font-bold'
}

// --- Live Responses Analytics ---
const currentQResponses = computed(() => {
  return props.allResponses[effectiveQuestionId.value] || {}
})

// Connected students tracking (derived from the single shared list: props.activeStudents)
const activeStudentsCount = computed(() => {
  return props.activeStudents.length
})

const connectedStudentIds = computed(() => {
  return new Set(
    props.activeStudents
      .map((s) => (typeof s === 'object' && s ? s.studentId : ''))
      .filter(Boolean)
  )
})

const connectedStudentNames = computed(() => {
  return new Set(
    props.activeStudents
      .map((s) => (typeof s === 'object' && s ? (s.displayName || s.name) : s))
      .filter(Boolean)
  )
})

function isStudentConnected(studentId, studentName) {
  if (studentId) return connectedStudentIds.value.has(studentId)
  if (studentName) return connectedStudentNames.value.has(studentName)
  return false
}

// Student responses for this question
const answeredResponses = computed(() => {
  return Object.entries(currentQResponses.value)
    .filter(([_, resp]) => Boolean(resp && resp.selectedOption))
    .map(([key, resp]) => ({
      responderKey: key,
      studentId: resp.studentId || '',
      studentName: resp.studentName || key,
      selectedOption: resp.selectedOption,
      isCorrect: Boolean(resp.isCorrect),
      hasChanged: Boolean(resp.hasChanged || (resp.changeCount && resp.changeCount > 0)),
      timestamp: resp.timestamp || 0
    }))
})

// "Answered" counts each student once
const answeredCount = computed(() => {
  return answeredResponses.value.length
})

const correctCount = computed(() => {
  return answeredResponses.value.filter((r) => r.isCorrect).length
})

const incorrectCount = computed(() => {
  return answeredResponses.value.filter((r) => !r.isCorrect).length
})

// Students who answered and then disconnected/left
const answeredAndLeftCount = computed(() => {
  return answeredResponses.value.filter(
    (resp) => !isStudentConnected(resp.studentId, resp.studentName)
  ).length
})

// Total students in the class for this question: connected students + students who answered and then left
const totalStudentsForQuestion = computed(() => {
  return activeStudentsCount.value + answeredAndLeftCount.value
})

// Answered percentage: answered / totalStudentsForQuestion (0% if total is 0, never > 100%)
const progressPercentage = computed(() => {
  if (totalStudentsForQuestion.value === 0) return 0
  const ratio = (answeredCount.value / totalStudentsForQuestion.value) * 100
  return Math.min(100, Math.max(0, Math.round(ratio)))
})

// Participants list: connected students (with answers or waiting) + students who answered and left (with "Left" label)
const studentResponsesList = computed(() => {
  const list = []
  const recorded = new Set()

  // 1. All currently connected students in join order
  for (const st of props.activeStudents) {
    const studentId = typeof st === 'object' && st ? st.studentId : ''
    const rawName = typeof st === 'object' && st ? st.name : st
    const displayName = typeof st === 'object' && st ? (st.displayName || st.name) : st
    if (!rawName && !studentId) continue

    // Lookup response by studentId first; only fall back to name if student has no studentId
    const resp = (studentId && currentQResponses.value[studentId]) ||
                 (!studentId && (currentQResponses.value[rawName] || currentQResponses.value[displayName])) ||
                 null
    const hasAnswer = Boolean(resp && resp.selectedOption)

    list.push({
      studentKey: studentId || rawName,
      studentId: studentId || '',
      studentName: displayName || rawName,
      selectedOption: hasAnswer ? resp.selectedOption : null,
      isCorrect: hasAnswer ? Boolean(resp.isCorrect) : false,
      hasChanged: hasAnswer ? Boolean(resp.hasChanged || (resp.changeCount && resp.changeCount > 0)) : false,
      hasLeft: false
    })

    if (studentId) recorded.add(studentId)
    else {
      if (rawName) recorded.add(rawName)
      if (displayName) recorded.add(displayName)
    }
  }

  // 2. Students who answered and then left (in currentQResponses but not in connected list)
  for (const [key, resp] of Object.entries(currentQResponses.value)) {
    if (!resp || !resp.selectedOption) continue
    const respId = resp.studentId || key
    const respName = resp.studentName || key

    if (respId && recorded.has(respId)) {
      continue
    }
    if (!respId && (recorded.has(respName) || recorded.has(key))) {
      continue
    }

    list.push({
      studentKey: respId || key,
      studentId: respId,
      studentName: respName,
      selectedOption: resp.selectedOption,
      isCorrect: Boolean(resp.isCorrect),
      hasChanged: Boolean(resp.hasChanged || (resp.changeCount && resp.changeCount > 0)),
      hasLeft: true
    })

    if (respId) recorded.add(respId)
    else {
      recorded.add(respName)
      recorded.add(key)
    }
  }

  return list
})

// Unanswered connected students (excludes students who have left, never includes Mentor)
const unansweredConnectedStudents = computed(() => {
  return studentResponsesList.value.filter((st) => !st.hasLeft && !st.selectedOption)
})

const unansweredCount = computed(() => {
  return unansweredConnectedStudents.value.length
})

const unansweredCountText = computed(() => {
  return unansweredCount.value === 1
    ? '1 student has not answered'
    : `${unansweredCount.value} students have not answered`
})

const alertCooldownSeconds = computed(() => {
  if (!mcqAlertContext) return 0
  const until = mcqAlertContext.alertCooldownUntilByQuestion.value[effectiveQuestionId.value] || 0
  const remainingMs = until - mcqAlertContext.cooldownNow.value
  return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0
})

const isAlertDisabled = computed(() => {
  return props.isRevealed || unansweredCount.value === 0 || alertCooldownSeconds.value > 0
})

function emitAlert() {
  if (!props.isMentor || isAlertDisabled.value || !mcqAlertContext) return
  const targetStudents = unansweredConnectedStudents.value.map((st) => st.studentName)
  mcqAlertContext.sendQuestionAlert(effectiveQuestionId.value, targetStudents)
}

const visibleStudentAlert = computed(() => {
  if (props.isMentor || !mcqAlertContext) return null
  if (hasSubmitted.value || props.isRevealed || isSessionEnded.value) return null
  const qId = effectiveQuestionId.value
  const alert = mcqAlertContext.questionAlerts.value[qId]
  if (!alert) return null
  if (mcqAlertContext.dismissedAlertIds.value[qId] === alert.alertId) return null
  return alert
})

function dismissStudentAlert() {
  if (!mcqAlertContext) return
  const alert = visibleStudentAlert.value
  if (!alert) return
  mcqAlertContext.dismissQuestionAlert(effectiveQuestionId.value, alert.alertId)
}
</script>

<style scoped>
.question-view-student {
  padding-bottom: calc(96px + env(safe-area-inset-bottom, 0px));
}
</style>
