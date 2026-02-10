'use client';

import React, { useState } from 'react';
import { DecisionData, BlockColor } from '@/lib/types';
import { ArrowLeft, ArrowRight, Check, Sparkles } from 'lucide-react';

interface DecisionFlowProps {
  onComplete: (decisionData: DecisionData) => void;
  onCancel: () => void;
  onCreateNode: (content: string, color: BlockColor, stepKey: string) => void;
}

// AI synthesis function
async function getAISynthesis(responses: Record<string, string>): Promise<string> {
  const prompt = `You are a decision-making coach. Analyze this person's thinking using the Fear Setting framework and provide a clear, actionable synthesis.

Decision: ${responses['question']}

Context: ${responses['context']}

Worst Case: ${responses['worst-case']}

Prevention/Mitigation: ${responses['prevention']}

Best Case: ${responses['best-case']}

Cost of Inaction: ${responses['inaction']}

Provide a synthesis that:
1. Identifies key patterns or contradictions in their thinking
2. Points out risks they might have missed
3. Highlights their strongest points
4. Challenges any weak assumptions
5. Gives a clear recommendation

Keep it concise (3-4 paragraphs max). Be direct and honest.`;

  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: prompt }],
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to get AI synthesis');
  }

  const data = await response.json();
  return data.message || 'Unable to generate synthesis.';
}

interface Step {
  key: string;
  question: string;
  placeholder: string;
  color: BlockColor;
}

const STEPS: Step[] = [
  {
    key: 'question',
    question: 'What decision are you facing?',
    placeholder: 'e.g., Should I quit my job and go full-time on my startup?',
    color: 'yellow'
  },
  {
    key: 'context',
    question: "What's the situation? Give me some context.",
    placeholder: "e.g., I've been working on this for 6 months, have some traction...",
    color: 'blue'
  },
  {
    key: 'worst-case',
    question: "What's the absolute worst-case scenario if you do this?",
    placeholder: 'e.g., I burn through savings, have to move back home, career gap...',
    color: 'orange'
  },
  {
    key: 'prevention',
    question: 'What could you do to prevent or mitigate that worst case?',
    placeholder: 'e.g., Keep 6 months runway, line up freelance work, set a deadline...',
    color: 'green'
  },
  {
    key: 'best-case',
    question: "What's the best realistic outcome if this works?",
    placeholder: 'e.g., Reach ramen profitability, have freedom, prove the concept...',
    color: 'green'
  },
  {
    key: 'inaction',
    question: "What's the cost of NOT deciding? In 6 months, 1 year, 3 years?",
    placeholder: 'e.g., Stay stuck, regret not trying, watch the window close...',
    color: 'pink'
  },
];

export default function DecisionFlow({ onComplete, onCancel, onCreateNode }: DecisionFlowProps) {
  const [step, setStep] = useState(0);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [currentInput, setCurrentInput] = useState('');
  const [aiSynthesis, setAiSynthesis] = useState<string>('');
  const [isLoadingSynthesis, setIsLoadingSynthesis] = useState(false);

  const currentStep = STEPS[step];
  const isLastStep = step === STEPS.length - 1;
  const isSynthesisPhase = step === STEPS.length;
  const isCommitPhase = step > STEPS.length;

  const handleNext = async () => {
    if (!currentInput.trim()) return;

    const newResponses = { ...responses, [currentStep.key]: currentInput };
    setResponses(newResponses);

    // Create node on canvas for each response
    onCreateNode(currentInput, currentStep.color, currentStep.key);

    if (isLastStep) {
      // Move to synthesis phase and get AI analysis
      setStep(STEPS.length);
      setIsLoadingSynthesis(true);

      try {
        const synthesis = await getAISynthesis(newResponses);
        setAiSynthesis(synthesis);
      } catch (error) {
        console.error('Error getting AI synthesis:', error);
        setAiSynthesis('Unable to generate analysis. You can still proceed with your decision.');
      } finally {
        setIsLoadingSynthesis(false);
      }
    } else {
      setStep(step + 1);
      setCurrentInput('');
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
      // Restore previous input
      setCurrentInput(responses[STEPS[step - 1].key] || '');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleNext();
    }
  };

  // Synthesis phase
  if (isSynthesisPhase) {
    return (
      <SynthesisPhase
        synthesis={aiSynthesis}
        isLoading={isLoadingSynthesis}
        onContinue={() => setStep(STEPS.length + 1)}
        onBack={() => {
          setStep(STEPS.length - 1);
          setCurrentInput(responses[STEPS[STEPS.length - 1].key] || '');
        }}
      />
    );
  }

  // Commit phase
  if (isCommitPhase) {
    return (
      <CommitPhase
        responses={responses}
        onComplete={onComplete}
        onBack={() => setStep(STEPS.length)}
      />
    );
  }

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-primary)' }}>
      {/* Header */}
      <div className="px-6 py-4" style={{
        borderBottom: '1px solid var(--border-primary)',
        background: 'var(--bg-elevated)'
      }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Decision Mode
          </h2>
          <button
            onClick={onCancel}
            className="text-sm hover:opacity-70 transition-opacity"
            style={{ color: 'var(--text-secondary)' }}
          >
            Cancel
          </button>
        </div>

        {/* Progress bar */}
        <div className="flex gap-1">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className="h-1 flex-1 rounded transition-all duration-200"
              style={{
                background: i <= step ? 'var(--accent)' : 'var(--bg-tertiary)'
              }}
            />
          ))}
        </div>
      </div>

      {/* Question */}
      <div className="flex-1 flex flex-col justify-center px-6 py-8 overflow-y-auto">
        <div className="max-w-xl mx-auto w-full">
          <p className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>
            Step {step + 1} of {STEPS.length}
          </p>
          <h3 className="text-xl font-semibold mb-6" style={{ color: 'var(--text-primary)' }}>
            {currentStep.question}
          </h3>

          <textarea
            value={currentInput}
            onChange={(e) => setCurrentInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={currentStep.placeholder}
            className="w-full h-32 px-4 py-3 rounded-lg resize-none transition-all duration-150"
            style={{
              border: '1px solid var(--border-primary)',
              background: 'var(--bg-elevated)',
              color: 'var(--text-primary)',
              fontSize: '14px',
              lineHeight: '1.5'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = 'var(--accent)';
              e.target.style.boxShadow = '0 0 0 3px var(--accent-muted)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'var(--border-primary)';
              e.target.style.boxShadow = 'none';
            }}
            autoFocus
          />

          <div className="flex justify-between mt-4">
            <button
              onClick={handleBack}
              disabled={step === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-150"
              style={{
                color: step === 0 ? 'var(--text-tertiary)' : 'var(--text-secondary)',
                cursor: step === 0 ? 'not-allowed' : 'pointer',
                opacity: step === 0 ? 0.5 : 1
              }}
              onMouseEnter={(e) => {
                if (step > 0) {
                  e.currentTarget.style.color = 'var(--text-primary)';
                }
              }}
              onMouseLeave={(e) => {
                if (step > 0) {
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }
              }}
            >
              <ArrowLeft size={16} />
              <span className="text-sm">Back</span>
            </button>

            <button
              onClick={handleNext}
              disabled={!currentInput.trim()}
              className="flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-all duration-150"
              style={{
                background: currentInput.trim() ? 'var(--accent)' : 'var(--bg-tertiary)',
                color: currentInput.trim() ? 'white' : 'var(--text-tertiary)',
                cursor: currentInput.trim() ? 'pointer' : 'not-allowed',
                opacity: currentInput.trim() ? 1 : 0.5
              }}
              onMouseEnter={(e) => {
                if (currentInput.trim()) {
                  e.currentTarget.style.background = 'var(--accent-hover)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                }
              }}
              onMouseLeave={(e) => {
                if (currentInput.trim()) {
                  e.currentTarget.style.background = 'var(--accent)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }
              }}
            >
              <span className="text-sm">{isLastStep ? 'Continue' : 'Next'}</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-3 text-center" style={{
        borderTop: '1px solid var(--border-primary)',
        background: 'var(--bg-elevated)'
      }}>
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          Using the Fear Setting framework by Tim Ferriss
        </p>
      </div>
    </div>
  );
}

// ============================================
// SYNTHESIS PHASE
// ============================================

interface SynthesisPhaseProps {
  synthesis: string;
  isLoading: boolean;
  onContinue: () => void;
  onBack: () => void;
}

function SynthesisPhase({ synthesis, isLoading, onContinue, onBack }: SynthesisPhaseProps) {
  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-primary)' }}>
      {/* Header */}
      <div className="px-6 py-4" style={{
        borderBottom: '1px solid var(--border-primary)',
        background: 'var(--bg-elevated)'
      }}>
        <div className="flex items-center gap-2">
          <Sparkles size={16} style={{ color: 'var(--accent)' }} />
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            AI Analysis
          </h2>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-xl mx-auto">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--accent)' }}></div>
              <p className="mt-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
                Analyzing your thinking...
              </p>
            </div>
          ) : (
            <div
              className="rounded-lg p-6"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-primary)',
                whiteSpace: 'pre-wrap',
                lineHeight: '1.6'
              }}
            >
              <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                {synthesis}
              </p>
            </div>
          )}

          {/* Actions */}
          {!isLoading && (
            <div className="flex justify-between mt-6">
              <button
                onClick={onBack}
                className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-150"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--text-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }}
              >
                <ArrowLeft size={16} />
                <span className="text-sm">Back</span>
              </button>

              <button
                onClick={onContinue}
                className="flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-all duration-150"
                style={{
                  background: 'var(--accent)',
                  color: 'white'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--accent-hover)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--accent)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <span className="text-sm">Continue to Decision</span>
                <ArrowRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// COMMIT PHASE
// ============================================

interface CommitPhaseProps {
  responses: Record<string, string>;
  onComplete: (decisionData: DecisionData) => void;
  onBack: () => void;
}

function CommitPhase({ responses, onComplete, onBack }: CommitPhaseProps) {
  const [choice, setChoice] = useState('');
  const [confidence, setConfidence] = useState(5);
  const [reviewWeeks, setReviewWeeks] = useState(4);

  const handleCommit = () => {
    if (!choice.trim()) return;

    const reviewDate = new Date();
    reviewDate.setDate(reviewDate.getDate() + reviewWeeks * 7);

    const decisionData: DecisionData = {
      question: responses['question'],
      context: responses['context'],
      worstCase: responses['worst-case'],
      prevention: responses['prevention'],
      bestCase: responses['best-case'],
      costOfInaction: responses['inaction'],
      choice: choice,
      confidence: confidence,
      createdAt: new Date().toISOString(),
      reviewDate: reviewDate.toISOString(),
    };

    onComplete(decisionData);
  };

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-primary)' }}>
      {/* Header */}
      <div className="px-6 py-4" style={{
        borderBottom: '1px solid var(--border-primary)',
        background: 'var(--bg-elevated)'
      }}>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          Time to Decide
        </h2>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-xl mx-auto">
          {/* Summary */}
          <div
            className="rounded-lg p-4 mb-6"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-primary)'
            }}
          >
            <h4 className="font-medium mb-2" style={{ color: 'var(--text-primary)', fontSize: '14px' }}>
              {responses['question']}
            </h4>
            <div className="space-y-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
              <p><strong>Worst case:</strong> {responses['worst-case']?.substring(0, 80)}...</p>
              <p><strong>Best case:</strong> {responses['best-case']?.substring(0, 80)}...</p>
            </div>
          </div>

          {/* Decision input */}
          <div className="mb-6">
            <label className="block text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
              What are you going to do?
            </label>
            <textarea
              value={choice}
              onChange={(e) => setChoice(e.target.value)}
              placeholder="I will..."
              className="w-full h-24 px-4 py-3 rounded-lg resize-none transition-all duration-150"
              style={{
                border: '1px solid var(--border-primary)',
                background: 'var(--bg-elevated)',
                color: 'var(--text-primary)',
                fontSize: '14px',
                lineHeight: '1.5'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'var(--accent)';
                e.target.style.boxShadow = '0 0 0 3px var(--accent-muted)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'var(--border-primary)';
                e.target.style.boxShadow = 'none';
              }}
              autoFocus
            />
          </div>

          {/* Confidence slider */}
          <div className="mb-6">
            <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
              How confident are you? ({confidence}/10)
            </label>
            <input
              type="range"
              min="1"
              max="10"
              value={confidence}
              onChange={(e) => setConfidence(parseInt(e.target.value))}
              className="w-full h-1 rounded-lg appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${(confidence - 1) * 11.11}%, var(--bg-tertiary) ${(confidence - 1) * 11.11}%, var(--bg-tertiary) 100%)`
              }}
            />
            <div className="flex justify-between mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
              <span>Not sure</span>
              <span>Very confident</span>
            </div>
          </div>

          {/* Review date */}
          <div className="mb-6">
            <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
              When should we check in on this?
            </label>
            <select
              value={reviewWeeks}
              onChange={(e) => setReviewWeeks(parseInt(e.target.value))}
              className="w-full px-4 py-2 rounded-lg transition-all duration-150"
              style={{
                border: '1px solid var(--border-primary)',
                background: 'var(--bg-elevated)',
                color: 'var(--text-primary)',
                fontSize: '14px'
              }}
            >
              <option value={1}>1 week</option>
              <option value={2}>2 weeks</option>
              <option value={4}>1 month</option>
              <option value={8}>2 months</option>
              <option value={12}>3 months</option>
              <option value={26}>6 months</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex justify-between">
            <button
              onClick={onBack}
              className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-150"
              style={{ color: 'var(--text-secondary)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
            >
              <ArrowLeft size={16} />
              <span className="text-sm">Back</span>
            </button>

            <button
              onClick={handleCommit}
              disabled={!choice.trim()}
              className="flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all duration-150"
              style={{
                background: choice.trim() ? 'var(--accent)' : 'var(--bg-tertiary)',
                color: choice.trim() ? 'white' : 'var(--text-tertiary)',
                cursor: choice.trim() ? 'pointer' : 'not-allowed',
                opacity: choice.trim() ? 1 : 0.5
              }}
              onMouseEnter={(e) => {
                if (choice.trim()) {
                  e.currentTarget.style.background = 'var(--accent-hover)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                }
              }}
              onMouseLeave={(e) => {
                if (choice.trim()) {
                  e.currentTarget.style.background = 'var(--accent)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }
              }}
            >
              <Check size={16} />
              <span className="text-sm">Commit to this decision</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
