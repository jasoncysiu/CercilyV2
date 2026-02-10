'use client';

import React, { useState } from 'react';
import { SynthesizedDecision } from '@/lib/types';
import { X, Calendar, ThumbsUp, Minus, ThumbsDown, CheckCircle, Eye } from 'lucide-react';

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  decision: SynthesizedDecision | null;
  onSubmitReview: (decisionId: string, review: {
    actualOutcome: string;
    learnings: string;
    outcomeRating: 'good' | 'neutral' | 'bad';
  }) => void;
  onViewCanvas?: () => void;
}

export default function ReviewModal({
  isOpen,
  onClose,
  decision,
  onSubmitReview,
  onViewCanvas,
}: ReviewModalProps) {
  const [actualOutcome, setActualOutcome] = useState('');
  const [learnings, setLearnings] = useState('');
  const [outcomeRating, setOutcomeRating] = useState<'good' | 'neutral' | 'bad' | null>(null);

  if (!isOpen || !decision) return null;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const handleSubmit = () => {
    if (!outcomeRating) return;

    onSubmitReview(decision.id, {
      actualOutcome: actualOutcome.trim(),
      learnings: learnings.trim(),
      outcomeRating,
    });

    // Reset form
    setActualOutcome('');
    setLearnings('');
    setOutcomeRating(null);
  };

  const ratingOptions: { value: 'good' | 'neutral' | 'bad'; label: string; icon: React.ReactNode; color: string }[] = [
    { value: 'good', label: 'Good', icon: <ThumbsUp size={20} />, color: 'var(--success)' },
    { value: 'neutral', label: 'Neutral', icon: <Minus size={20} />, color: 'var(--text-tertiary)' },
    { value: 'bad', label: 'Bad', icon: <ThumbsDown size={20} />, color: 'var(--error)' },
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="review-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-primary)',
          borderRadius: '16px',
          maxWidth: '600px',
          width: '90vw',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-elevated)',
            borderRadius: '16px 16px 0 0',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {decision.reviewedAt ? (
              <Eye size={20} style={{ color: 'var(--accent)' }} />
            ) : (
              <CheckCircle size={20} style={{ color: 'var(--accent)' }} />
            )}
            <h2 style={{
              margin: 0,
              fontSize: '16px',
              fontWeight: 600,
              color: 'var(--text-primary)'
            }}>
              {decision.reviewedAt ? 'Decision Details' : 'Review Decision'}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              color: 'var(--text-tertiary)',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '24px',
        }}>
          {/* Original Decision Info */}
          <div style={{
            padding: '16px',
            background: 'var(--bg-elevated)',
            borderRadius: '10px',
            border: '1px solid var(--border-primary)',
            marginBottom: '24px',
          }}>
            <div style={{
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              color: 'var(--text-tertiary)',
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}>
              <Calendar size={12} />
              Decision made on {formatDate(decision.createdAt)}
            </div>
            <h3 style={{
              margin: '0 0 10px 0',
              fontSize: '15px',
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}>
              {decision.question}
            </h3>
            <p style={{
              margin: '0 0 12px 0',
              fontSize: '14px',
              color: 'var(--text-secondary)',
              lineHeight: '1.5',
            }}>
              <strong>Your decision:</strong> {decision.choice}
            </p>
            {decision.keyReasoning.length > 0 && (
              <div style={{ marginBottom: '12px' }}>
                <p style={{
                  margin: '0 0 6px 0',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--text-tertiary)',
                }}>
                  Your reasoning:
                </p>
                <ul style={{
                  margin: 0,
                  paddingLeft: '16px',
                  fontSize: '13px',
                  color: 'var(--text-secondary)',
                }}>
                  {decision.keyReasoning.slice(0, 3).map((r, i) => (
                    <li key={i} style={{ marginBottom: '4px' }}>{r.point}</li>
                  ))}
                </ul>
              </div>
            )}
            {onViewCanvas && (
              <button
                onClick={onViewCanvas}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 12px',
                  fontSize: '12px',
                  fontWeight: 500,
                  border: '1px solid var(--border-primary)',
                  borderRadius: '6px',
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--bg-tertiary)';
                  e.currentTarget.style.borderColor = 'var(--accent)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = 'var(--border-primary)';
                }}
              >
                <Eye size={14} />
                View Original Canvas
              </button>
            )}
          </div>

          {/* Review Form or Review Results */}
          {decision.reviewedAt ? (
            // Already reviewed - show review results
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{
                padding: '12px 16px',
                background: decision.outcomeRating === 'good'
                  ? 'rgba(16, 185, 129, 0.1)'
                  : decision.outcomeRating === 'bad'
                    ? 'rgba(239, 68, 68, 0.1)'
                    : 'var(--bg-tertiary)',
                borderRadius: '10px',
                border: `1px solid ${
                  decision.outcomeRating === 'good'
                    ? 'rgba(16, 185, 129, 0.3)'
                    : decision.outcomeRating === 'bad'
                      ? 'rgba(239, 68, 68, 0.3)'
                      : 'var(--border-primary)'
                }`,
              }}>
                <div style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  color: 'var(--text-tertiary)',
                  marginBottom: '6px',
                }}>
                  Outcome Rating
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {decision.outcomeRating === 'good' && <ThumbsUp size={18} style={{ color: 'var(--success)' }} />}
                  {decision.outcomeRating === 'neutral' && <Minus size={18} style={{ color: 'var(--text-tertiary)' }} />}
                  {decision.outcomeRating === 'bad' && <ThumbsDown size={18} style={{ color: 'var(--error)' }} />}
                  <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                    {decision.outcomeRating}
                  </span>
                </div>
              </div>

              {decision.actualOutcome && (
                <div>
                  <div style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    color: 'var(--text-tertiary)',
                    marginBottom: '6px',
                  }}>
                    What Actually Happened
                  </div>
                  <p style={{
                    margin: 0,
                    fontSize: '14px',
                    color: 'var(--text-primary)',
                    lineHeight: '1.5',
                  }}>
                    {decision.actualOutcome}
                  </p>
                </div>
              )}

              {decision.learnings && (
                <div>
                  <div style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    color: 'var(--text-tertiary)',
                    marginBottom: '6px',
                  }}>
                    Learnings
                  </div>
                  <p style={{
                    margin: 0,
                    fontSize: '14px',
                    color: 'var(--text-primary)',
                    lineHeight: '1.5',
                  }}>
                    {decision.learnings}
                  </p>
                </div>
              )}

              <div style={{
                fontSize: '12px',
                color: 'var(--text-tertiary)',
                fontStyle: 'italic',
              }}>
                Reviewed on {formatDate(decision.reviewedAt)}
              </div>
            </div>
          ) : (
            // Not yet reviewed - show review form
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Outcome Rating */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginBottom: '10px',
                }}>
                  How did this decision turn out?
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {ratingOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setOutcomeRating(option.value)}
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '16px 12px',
                        border: `2px solid ${outcomeRating === option.value ? option.color : 'var(--border-primary)'}`,
                        borderRadius: '10px',
                        background: outcomeRating === option.value
                          ? `${option.color}15`
                          : 'var(--bg-elevated)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (outcomeRating !== option.value) {
                          e.currentTarget.style.borderColor = option.color;
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (outcomeRating !== option.value) {
                          e.currentTarget.style.borderColor = 'var(--border-primary)';
                        }
                      }}
                    >
                      <span style={{ color: option.color }}>{option.icon}</span>
                      <span style={{
                        fontSize: '13px',
                        fontWeight: 500,
                        color: outcomeRating === option.value ? option.color : 'var(--text-secondary)',
                      }}>
                        {option.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* What Actually Happened */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginBottom: '8px',
                }}>
                  What actually happened?
                </label>
                <textarea
                  value={actualOutcome}
                  onChange={(e) => setActualOutcome(e.target.value)}
                  placeholder="Describe the outcome of your decision..."
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    fontSize: '14px',
                    border: '1px solid var(--border-primary)',
                    borderRadius: '10px',
                    background: 'var(--bg-elevated)',
                    color: 'var(--text-primary)',
                    resize: 'none',
                    minHeight: '100px',
                    lineHeight: '1.5',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'var(--accent)';
                    e.target.style.boxShadow = '0 0 0 3px var(--accent-muted)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'var(--border-primary)';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>

              {/* What Did You Learn */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginBottom: '8px',
                }}>
                  What did you learn?
                </label>
                <textarea
                  value={learnings}
                  onChange={(e) => setLearnings(e.target.value)}
                  placeholder="Reflect on what this experience taught you..."
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    fontSize: '14px',
                    border: '1px solid var(--border-primary)',
                    borderRadius: '10px',
                    background: 'var(--bg-elevated)',
                    color: 'var(--text-primary)',
                    resize: 'none',
                    minHeight: '80px',
                    lineHeight: '1.5',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'var(--accent)';
                    e.target.style.boxShadow = '0 0 0 3px var(--accent-muted)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'var(--border-primary)';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border-primary)',
            display: 'flex',
            justifyContent: decision.reviewedAt ? 'flex-end' : 'space-between',
            alignItems: 'center',
            background: 'var(--bg-elevated)',
            borderRadius: '0 0 16px 16px',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              fontSize: '14px',
              border: '1px solid var(--border-primary)',
              borderRadius: '8px',
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontWeight: 500,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-tertiary)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            {decision.reviewedAt ? 'Close' : 'Cancel'}
          </button>
          {!decision.reviewedAt && (
            <button
              onClick={handleSubmit}
              disabled={!outcomeRating}
              style={{
                padding: '10px 24px',
                fontSize: '14px',
                border: 'none',
                borderRadius: '8px',
                background: outcomeRating ? 'var(--accent)' : 'var(--bg-tertiary)',
                color: outcomeRating ? 'white' : 'var(--text-tertiary)',
                cursor: outcomeRating ? 'pointer' : 'not-allowed',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                opacity: outcomeRating ? 1 : 0.6,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (outcomeRating) {
                  e.currentTarget.style.background = 'var(--accent-hover)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }
              }}
              onMouseLeave={(e) => {
                if (outcomeRating) {
                  e.currentTarget.style.background = 'var(--accent)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }
              }}
            >
              <CheckCircle size={16} />
              Save Review
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
