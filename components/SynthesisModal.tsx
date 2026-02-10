'use client';

import React, { useState, useEffect } from 'react';
import { SynthesisResult, SynthesisOption, ReasoningPoint, BlockColor, SynthesizedDecision } from '@/lib/types';
import { X, Sparkles, Link2, AlertTriangle, Check, ChevronRight, Calendar } from 'lucide-react';

interface SynthesisModalProps {
  isOpen: boolean;
  onClose: () => void;
  synthesis: SynthesisResult | null;
  isLoading: boolean;
  projectId: string;
  projectName: string;
  onCommit: (decision: Omit<SynthesizedDecision, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onNavigateToNode?: (nodeId: string) => void;
}

const COLOR_MAP: Record<BlockColor, string> = {
  yellow: '#FCD34D',
  blue: '#60A5FA',
  pink: '#F472B6',
  green: '#34D399',
  orange: '#FB923C',
};

export default function SynthesisModal({
  isOpen,
  onClose,
  synthesis,
  isLoading,
  projectId,
  projectName,
  onCommit,
  onNavigateToNode,
}: SynthesisModalProps) {
  // Editable fields
  const [editedQuestion, setEditedQuestion] = useState('');
  const [editedOptions, setEditedOptions] = useState<SynthesisOption[]>([]);
  const [editedLeaning, setEditedLeaning] = useState('');
  const [editedUnresolved, setEditedUnresolved] = useState<string[]>([]);

  // Commitment fields
  const [choice, setChoice] = useState('');
  const [reviewWeeks, setReviewWeeks] = useState(4); // Default 1 month

  // Update local state when synthesis changes
  useEffect(() => {
    if (synthesis) {
      setEditedQuestion(synthesis.question);
      setEditedOptions(synthesis.options);
      setEditedLeaning(synthesis.leaning);
      setEditedUnresolved(synthesis.unresolved);
      setChoice(synthesis.leaning || '');
    }
  }, [synthesis]);

  if (!isOpen) return null;

  const handleCommit = () => {
    if (!choice.trim() || !synthesis) return;

    const reviewDate = new Date();
    reviewDate.setDate(reviewDate.getDate() + reviewWeeks * 7);

    const decision: Omit<SynthesizedDecision, 'id' | 'createdAt' | 'updatedAt'> = {
      projectId,
      question: editedQuestion,
      options: editedOptions,
      leaning: editedLeaning,
      keyReasoning: synthesis.keyReasoning,
      unresolved: editedUnresolved,
      choice: choice.trim(),
      reasoningNodeIds: synthesis.keyReasoning.map(r => r.nodeId),
      reviewDate: reviewDate.toISOString(),
    };

    onCommit(decision);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="synthesis-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-primary)',
          borderRadius: '16px',
          maxWidth: '720px',
          width: '90vw',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        {/* Header */}
        <div
          className="modal-header"
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
            <Sparkles size={20} style={{ color: 'var(--accent)' }} />
            <h2 style={{
              margin: 0,
              fontSize: '16px',
              fontWeight: 600,
              color: 'var(--text-primary)'
            }}>
              Decision Synthesis
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
        <div
          className="modal-content"
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '24px',
          }}
        >
          {isLoading ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '60px 20px',
              gap: '16px',
            }}>
              <div
                className="animate-spin"
                style={{
                  width: '40px',
                  height: '40px',
                  border: '3px solid var(--border-primary)',
                  borderTopColor: 'var(--accent)',
                  borderRadius: '50%',
                }}
              />
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                Analyzing your canvas...
              </p>
              <p style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>
                Finding patterns and synthesizing your thinking
              </p>
            </div>
          ) : synthesis ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Question */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '11px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  color: 'var(--text-tertiary)',
                  marginBottom: '8px',
                }}>
                  What You're Deciding
                </label>
                <textarea
                  value={editedQuestion}
                  onChange={(e) => setEditedQuestion(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    fontSize: '15px',
                    fontWeight: 500,
                    border: '1px solid var(--border-primary)',
                    borderRadius: '10px',
                    background: 'var(--bg-elevated)',
                    color: 'var(--text-primary)',
                    resize: 'none',
                    minHeight: '50px',
                    lineHeight: '1.4',
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
                <p style={{
                  fontSize: '11px',
                  color: 'var(--text-tertiary)',
                  marginTop: '4px',
                  fontStyle: 'italic',
                }}>
                  AI-generated from your canvas. Click to edit.
                </p>
              </div>

              {/* Options */}
              {editedOptions.length > 0 && (
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    color: 'var(--text-tertiary)',
                    marginBottom: '12px',
                  }}>
                    Options You Explored
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {editedOptions.map((option, idx) => (
                      <div
                        key={idx}
                        style={{
                          border: '1px solid var(--border-primary)',
                          borderRadius: '10px',
                          padding: '14px 16px',
                          background: 'var(--bg-elevated)',
                        }}
                      >
                        <h4 style={{
                          margin: '0 0 10px 0',
                          fontSize: '14px',
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                        }}>
                          {option.name}
                        </h4>
                        <div style={{ display: 'flex', gap: '16px' }}>
                          <div style={{ flex: 1 }}>
                            {option.pros.map((pro, i) => (
                              <div
                                key={i}
                                style={{
                                  fontSize: '13px',
                                  color: 'var(--success)',
                                  marginBottom: '4px',
                                  display: 'flex',
                                  alignItems: 'flex-start',
                                  gap: '6px',
                                }}
                              >
                                <Check size={14} style={{ marginTop: '2px', flexShrink: 0 }} />
                                <span>{pro}</span>
                              </div>
                            ))}
                          </div>
                          <div style={{ flex: 1 }}>
                            {option.cons.map((con, i) => (
                              <div
                                key={i}
                                style={{
                                  fontSize: '13px',
                                  color: 'var(--error)',
                                  marginBottom: '4px',
                                  display: 'flex',
                                  alignItems: 'flex-start',
                                  gap: '6px',
                                }}
                              >
                                <X size={14} style={{ marginTop: '2px', flexShrink: 0 }} />
                                <span>{con}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Leaning */}
              {editedLeaning && (
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    color: 'var(--text-tertiary)',
                    marginBottom: '8px',
                  }}>
                    You Seem to Be Leaning Toward
                  </label>
                  <div
                    style={{
                      padding: '12px 14px',
                      border: '1px solid var(--accent)',
                      borderRadius: '10px',
                      background: 'var(--accent-muted)',
                      color: 'var(--text-primary)',
                      fontSize: '14px',
                      fontWeight: 500,
                    }}
                  >
                    {editedLeaning}
                  </div>
                </div>
              )}

              {/* Key Reasoning */}
              {synthesis.keyReasoning.length > 0 && (
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    color: 'var(--text-tertiary)',
                    marginBottom: '12px',
                  }}>
                    Key Reasoning (from your canvas)
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {synthesis.keyReasoning.map((reason, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '10px',
                          padding: '10px 12px',
                          background: 'var(--bg-elevated)',
                          borderRadius: '8px',
                          border: '1px solid var(--border-primary)',
                        }}
                      >
                        <div
                          style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: reason.nodeColor ? COLOR_MAP[reason.nodeColor] : 'var(--accent)',
                            marginTop: '6px',
                            flexShrink: 0,
                          }}
                        />
                        <span style={{
                          flex: 1,
                          fontSize: '13px',
                          color: 'var(--text-primary)',
                          lineHeight: '1.5',
                        }}>
                          "{reason.point}"
                        </span>
                        {onNavigateToNode && (
                          <button
                            onClick={() => onNavigateToNode(reason.nodeId)}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              padding: '4px',
                              color: 'var(--text-tertiary)',
                              borderRadius: '4px',
                              display: 'flex',
                              alignItems: 'center',
                            }}
                            title="Navigate to source node"
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = 'var(--accent)';
                              e.currentTarget.style.background = 'var(--bg-tertiary)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = 'var(--text-tertiary)';
                              e.currentTarget.style.background = 'none';
                            }}
                          >
                            <Link2 size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Unresolved */}
              {editedUnresolved.length > 0 && (
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    color: 'var(--text-tertiary)',
                    marginBottom: '12px',
                  }}>
                    <AlertTriangle size={12} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                    Still Unresolved
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {editedUnresolved.map((item, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: '10px 12px',
                          background: 'rgba(245, 158, 11, 0.1)',
                          borderRadius: '8px',
                          border: '1px solid rgba(245, 158, 11, 0.3)',
                          fontSize: '13px',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Divider */}
              <div style={{
                height: '1px',
                background: 'var(--border-primary)',
                margin: '8px 0'
              }} />

              {/* Commitment Section */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginBottom: '10px',
                }}>
                  Ready to commit? What's your decision?
                </label>
                <textarea
                  value={choice}
                  onChange={(e) => setChoice(e.target.value)}
                  placeholder="I will..."
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

              {/* Review Date */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Calendar size={16} style={{ color: 'var(--text-tertiary)' }} />
                <label style={{
                  fontSize: '13px',
                  color: 'var(--text-secondary)',
                }}>
                  Review this decision in:
                </label>
                <select
                  value={reviewWeeks}
                  onChange={(e) => setReviewWeeks(parseInt(e.target.value))}
                  style={{
                    padding: '8px 12px',
                    fontSize: '13px',
                    border: '1px solid var(--border-primary)',
                    borderRadius: '8px',
                    background: 'var(--bg-elevated)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
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
            </div>
          ) : (
            <div style={{
              textAlign: 'center',
              padding: '40px 20px',
              color: 'var(--text-secondary)',
            }}>
              <p>No synthesis data available. Make sure your canvas has at least 3 nodes.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {!isLoading && synthesis && (
          <div
            className="modal-footer"
            style={{
              padding: '16px 24px',
              borderTop: '1px solid var(--border-primary)',
              display: 'flex',
              justifyContent: 'space-between',
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
              Cancel
            </button>
            <button
              onClick={handleCommit}
              disabled={!choice.trim()}
              style={{
                padding: '10px 24px',
                fontSize: '14px',
                border: 'none',
                borderRadius: '8px',
                background: choice.trim() ? 'var(--accent)' : 'var(--bg-tertiary)',
                color: choice.trim() ? 'white' : 'var(--text-tertiary)',
                cursor: choice.trim() ? 'pointer' : 'not-allowed',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                opacity: choice.trim() ? 1 : 0.6,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (choice.trim()) {
                  e.currentTarget.style.background = 'var(--accent-hover)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }
              }}
              onMouseLeave={(e) => {
                if (choice.trim()) {
                  e.currentTarget.style.background = 'var(--accent)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }
              }}
            >
              <Check size={16} />
              Commit to Decision
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
