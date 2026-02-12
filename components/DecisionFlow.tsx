'use client';

import React, { useState } from 'react';
import { DecisionData, BlockColor } from '@/lib/types';
import { ArrowLeft, ArrowRight, Check, Sparkles, X } from 'lucide-react';

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
  emoji: string;
}

const STEPS: Step[] = [
  {
    key: 'question',
    question: 'What decision are you facing?',
    placeholder: 'e.g., Should I quit my job and go full-time on my startup?',
    color: 'yellow',
    emoji: '🎯'
  },
  {
    key: 'context',
    question: "What's the situation? Give me some context.",
    placeholder: "e.g., I've been working on this for 6 months, have some traction...",
    color: 'blue',
    emoji: '📋'
  },
  {
    key: 'worst-case',
    question: "What's the absolute worst that could happen?",
    placeholder: 'e.g., I burn through savings, have to move back home, career gap...',
    color: 'orange',
    emoji: '⚠️'
  },
  {
    key: 'prevention',
    question: 'How could you prevent or mitigate that?',
    placeholder: 'e.g., Keep 6 months runway, line up freelance work, set a deadline...',
    color: 'green',
    emoji: '🛡️'
  },
  {
    key: 'best-case',
    question: "What's the best realistic outcome?",
    placeholder: 'e.g., Reach ramen profitability, have freedom, prove the concept...',
    color: 'green',
    emoji: '✨'
  },
  {
    key: 'inaction',
    question: "What's the cost of NOT deciding?",
    placeholder: 'e.g., Stay stuck, regret not trying, watch the window close...',
    color: 'pink',
    emoji: '⏳'
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
      setCurrentInput(responses[STEPS[step - 1].key] || '');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleNext();
    }
  };

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
    <div className="df-container">
      {/* Top bar — just cancel */}
      <div className="df-topbar">
        <button onClick={onCancel} className="df-cancel-btn">
          <X size={16} />
        </button>
      </div>

      {/* Centered content */}
      <div className="df-body">
        <div className="df-content">
          {/* Step indicator */}
          <div className="df-step-indicator">
            <span className="df-step-emoji">{currentStep.emoji}</span>
            <span className="df-step-count">Step {step + 1} of {STEPS.length}</span>
          </div>

          {/* Progress dots */}
          <div className="df-progress">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`df-progress-dot ${i < step ? 'completed' : ''} ${i === step ? 'active' : ''}`}
              />
            ))}
          </div>

          {/* Question */}
          <h1 className="df-question">{currentStep.question}</h1>

          {/* Textarea — Notion-style borderless */}
          <textarea
            value={currentInput}
            onChange={(e) => setCurrentInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={currentStep.placeholder}
            className="df-textarea"
            autoFocus
          />

          {/* Navigation */}
          <div className="df-nav">
            <button
              onClick={handleBack}
              disabled={step === 0}
              className="df-nav-btn df-nav-back"
            >
              <ArrowLeft size={16} />
              <span>Back</span>
            </button>

            <button
              onClick={handleNext}
              disabled={!currentInput.trim()}
              className={`df-nav-btn df-nav-next ${currentInput.trim() ? 'enabled' : ''}`}
            >
              <span>{isLastStep ? 'Analyze' : 'Continue'}</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Subtle footer */}
      <div className="df-footer">
        Fear Setting framework by Tim Ferriss
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
    <div className="df-container">
      <div className="df-body">
        <div className="df-content">
          <div className="df-step-indicator">
            <Sparkles size={16} className="df-sparkle-icon" />
            <span className="df-step-count">AI Analysis</span>
          </div>

          {isLoading ? (
            <div className="df-loading">
              <div className="df-loading-spinner" />
              <p className="df-loading-text">Analyzing your thinking...</p>
            </div>
          ) : (
            <>
              <div className="df-synthesis-card">
                {synthesis}
              </div>

              <div className="df-nav">
                <button onClick={onBack} className="df-nav-btn df-nav-back">
                  <ArrowLeft size={16} />
                  <span>Back</span>
                </button>
                <button onClick={onContinue} className="df-nav-btn df-nav-next enabled">
                  <span>Make your decision</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </>
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
    <div className="df-container">
      <div className="df-body">
        <div className="df-content">
          <div className="df-step-indicator">
            <span className="df-step-emoji">⚡</span>
            <span className="df-step-count">Time to decide</span>
          </div>

          {/* Summary callout */}
          <div className="df-callout">
            <p className="df-callout-title">{responses['question']}</p>
            <div className="df-callout-meta">
              <span>Worst: {responses['worst-case']?.substring(0, 60)}...</span>
              <span>Best: {responses['best-case']?.substring(0, 60)}...</span>
            </div>
          </div>

          {/* Decision input */}
          <div className="df-field">
            <label className="df-label">What are you going to do?</label>
            <textarea
              value={choice}
              onChange={(e) => setChoice(e.target.value)}
              placeholder="I will..."
              className="df-textarea df-textarea-short"
              autoFocus
            />
          </div>

          {/* Confidence */}
          <div className="df-field">
            <label className="df-label">
              Confidence level
              <span className="df-label-value">{confidence}/10</span>
            </label>
            <input
              type="range"
              min="1"
              max="10"
              value={confidence}
              onChange={(e) => setConfidence(parseInt(e.target.value))}
              className="df-range"
              style={{
                background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${(confidence - 1) * 11.11}%, var(--bg-tertiary) ${(confidence - 1) * 11.11}%, var(--bg-tertiary) 100%)`
              }}
            />
            <div className="df-range-labels">
              <span>Not sure</span>
              <span>Very confident</span>
            </div>
          </div>

          {/* Review date */}
          <div className="df-field">
            <label className="df-label">Check-in date</label>
            <select
              value={reviewWeeks}
              onChange={(e) => setReviewWeeks(parseInt(e.target.value))}
              className="df-select"
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
          <div className="df-nav">
            <button onClick={onBack} className="df-nav-btn df-nav-back">
              <ArrowLeft size={16} />
              <span>Back</span>
            </button>
            <button
              onClick={handleCommit}
              disabled={!choice.trim()}
              className={`df-nav-btn df-nav-commit ${choice.trim() ? 'enabled' : ''}`}
            >
              <Check size={16} />
              <span>Commit to this</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
