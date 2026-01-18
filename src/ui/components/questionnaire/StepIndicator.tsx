'use client';

import clsx from 'clsx';

interface Step {
  number: number;
  title: string;
}

interface StepIndicatorProps {
  steps: Step[];
  currentStep: number;
}

export function StepIndicator({ steps, currentStep }: StepIndicatorProps) {
  return (
    <div className="w-full mb-8">
      {/* Mobile view - simple dots */}
      <div className="flex justify-center gap-2 md:hidden">
        {steps.map((step) => (
          <div
            key={step.number}
            className={clsx(
              'w-3 h-3 rounded-full transition-all duration-300',
              step.number === currentStep
                ? 'bg-primary-600 scale-125'
                : step.number < currentStep
                ? 'bg-primary-400'
                : 'bg-gray-300'
            )}
          />
        ))}
      </div>

      {/* Desktop view - full progress bar */}
      <div className="hidden md:block">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.number} className="flex items-center flex-1">
              {/* Step circle */}
              <div className="flex flex-col items-center">
                <div
                  className={clsx(
                    'w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-all duration-300',
                    step.number === currentStep
                      ? 'bg-primary-600 text-white ring-4 ring-primary-100'
                      : step.number < currentStep
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-200 text-gray-500'
                  )}
                >
                  {step.number < currentStep ? (
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    step.number
                  )}
                </div>
                <span
                  className={clsx(
                    'mt-2 text-xs font-medium transition-colors duration-300',
                    step.number === currentStep
                      ? 'text-primary-600'
                      : step.number < currentStep
                      ? 'text-gray-600'
                      : 'text-gray-400'
                  )}
                >
                  {step.title}
                </span>
              </div>

              {/* Connector line */}
              {index < steps.length - 1 && (
                <div className="flex-1 mx-4 h-0.5 bg-gray-200">
                  <div
                    className={clsx(
                      'h-full bg-primary-600 transition-all duration-500',
                      step.number < currentStep ? 'w-full' : 'w-0'
                    )}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Progress percentage */}
      <div className="mt-4 text-center">
        <span className="text-sm text-gray-500">
          Paso {currentStep} de {steps.length}
        </span>
        <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-primary-600 h-2 rounded-full transition-all duration-500"
            style={{ width: `${(currentStep / steps.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
