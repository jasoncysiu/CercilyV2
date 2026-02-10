'use client';

import React, { useState } from 'react';
import { SynthesizedDecision } from '@/lib/types';
import { BookOpen, Clock, CheckCircle, AlertCircle, ChevronRight, Calendar, X, ThumbsUp, Minus, ThumbsDown } from 'lucide-react';

interface DecisionJournalViewProps {
  isOpen: boolean;
  onClose: () => void;
  decisions: SynthesizedDecision[];
  onReviewDecision: (decisionId: string) => void;
  onViewDecision: (decisionId: string) => void;
}

type FilterType = 'all' | 'pending' | 'reviewed';

export default function DecisionJournalView({
  isOpen,
  onClose,
  decisions,
  onReviewDecision,
  onViewDecision,
}: DecisionJournalViewProps) {
  const [filter, setFilter] = useState<FilterType>('all');

  if (!isOpen) return null;

  const now = new Date();

  // Categorize decisions
  const pendingReviews = decisions.filter(d => {
    if (d.reviewedAt) return false;
    const reviewDate = new Date(d.reviewDate);
    return reviewDate <= now;
  });

  const upcomingReviews = decisions.filter(d => {
    if (d.reviewedAt) return false;
    const reviewDate = new Date(d.reviewDate);
    return reviewDate > now;
  });

  const reviewedDecisions = decisions.filter(d => d.reviewedAt);

  // Filter decisions based on selected filter
  const getFilteredDecisions = () => {
    switch (filter) {
      case 'pending':
        return [...pendingReviews, ...upcomingReviews];
      case 'reviewed':
        return reviewedDecisions;
      default:
        return decisions;
    }
  };

  const filteredDecisions = getFilteredDecisions();

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getDaysUntilReview = (dateStr: string) => {
    const reviewDate = new Date(dateStr);
    const diffTime = reviewDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getOutcomeIcon = (rating?: 'good' | 'neutral' | 'bad') => {
    switch (rating) {
      case 'good':
        return <ThumbsUp size={14} style={{ color: 'var(--success)' }} />;
      case 'bad':
        return <ThumbsDown size={14} style={{ color: 'var(--error)' }} />;
      case 'neutral':
        return <Minus size={14} style={{ color: 'var(--text-tertiary)' }} />;
      default:
        return null;
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="decision-journal-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-primary)',
          borderRadius: '16px',
          maxWidth: '640px',
          width: '90vw',
          maxHeight: '80vh',
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
            <BookOpen size={20} style={{ color: 'var(--accent)' }} />
            <h2 style={{
              margin: 0,
              fontSize: '16px',
              fontWeight: 600,
              color: 'var(--text-primary)'
            }}>
              Decision Journal
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

        {/* Filter Tabs */}
        <div style={{
          display: 'flex',
          gap: '4px',
          padding: '12px 24px',
          borderBottom: '1px solid var(--border-primary)',
          background: 'var(--bg-elevated)',
        }}>
          {(['all', 'pending', 'reviewed'] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '6px 14px',
                fontSize: '13px',
                fontWeight: 500,
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                background: filter === f ? 'var(--accent)' : 'transparent',
                color: filter === f ? 'white' : 'var(--text-secondary)',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (filter !== f) {
                  e.currentTarget.style.background = 'var(--bg-tertiary)';
                }
              }}
              onMouseLeave={(e) => {
                if (filter !== f) {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              {f === 'all' ? 'All' : f === 'pending' ? 'Active' : 'Reviewed'}
              {f === 'pending' && pendingReviews.length > 0 && (
                <span style={{
                  marginLeft: '6px',
                  padding: '2px 6px',
                  fontSize: '11px',
                  borderRadius: '10px',
                  background: filter === f ? 'rgba(255,255,255,0.2)' : 'var(--error)',
                  color: filter === f ? 'white' : 'white',
                }}>
                  {pendingReviews.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '16px 24px',
        }}>
          {decisions.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '40px 20px',
              color: 'var(--text-secondary)',
            }}>
              <BookOpen size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
              <p style={{ fontSize: '14px', marginBottom: '8px' }}>No decisions yet</p>
              <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                Use the lightbulb button on your canvas to synthesize your first decision
              </p>
            </div>
          ) : filteredDecisions.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '40px 20px',
              color: 'var(--text-secondary)',
            }}>
              <p style={{ fontSize: '14px' }}>No decisions in this category</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Pending Reviews Section */}
              {filter !== 'reviewed' && pendingReviews.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <h3 style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    color: 'var(--error)',
                    marginBottom: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}>
                    <AlertCircle size={12} />
                    Pending Review ({pendingReviews.length})
                  </h3>
                  {pendingReviews.map((decision) => (
                    <DecisionCard
                      key={decision.id}
                      decision={decision}
                      isPendingReview
                      daysUntilReview={getDaysUntilReview(decision.reviewDate)}
                      formatDate={formatDate}
                      getOutcomeIcon={getOutcomeIcon}
                      onReview={() => onReviewDecision(decision.id)}
                      onView={() => onViewDecision(decision.id)}
                    />
                  ))}
                </div>
              )}

              {/* Active Decisions Section */}
              {filter !== 'reviewed' && upcomingReviews.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <h3 style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    color: 'var(--text-tertiary)',
                    marginBottom: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}>
                    <Clock size={12} />
                    Active Decisions ({upcomingReviews.length})
                  </h3>
                  {upcomingReviews.map((decision) => (
                    <DecisionCard
                      key={decision.id}
                      decision={decision}
                      isPendingReview={false}
                      daysUntilReview={getDaysUntilReview(decision.reviewDate)}
                      formatDate={formatDate}
                      getOutcomeIcon={getOutcomeIcon}
                      onReview={() => onReviewDecision(decision.id)}
                      onView={() => onViewDecision(decision.id)}
                    />
                  ))}
                </div>
              )}

              {/* Reviewed Decisions Section */}
              {filter !== 'pending' && reviewedDecisions.length > 0 && (
                <div>
                  <h3 style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    color: 'var(--text-tertiary)',
                    marginBottom: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}>
                    <CheckCircle size={12} />
                    Reviewed ({reviewedDecisions.length})
                  </h3>
                  {reviewedDecisions.map((decision) => (
                    <DecisionCard
                      key={decision.id}
                      decision={decision}
                      isPendingReview={false}
                      daysUntilReview={0}
                      formatDate={formatDate}
                      getOutcomeIcon={getOutcomeIcon}
                      onReview={() => onReviewDecision(decision.id)}
                      onView={() => onViewDecision(decision.id)}
                      isReviewed
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Decision Card Component
interface DecisionCardProps {
  decision: SynthesizedDecision;
  isPendingReview: boolean;
  daysUntilReview: number;
  formatDate: (dateStr: string) => string;
  getOutcomeIcon: (rating?: 'good' | 'neutral' | 'bad') => React.ReactNode;
  onReview: () => void;
  onView: () => void;
  isReviewed?: boolean;
}

function DecisionCard({
  decision,
  isPendingReview,
  daysUntilReview,
  formatDate,
  getOutcomeIcon,
  onReview,
  onView,
  isReviewed,
}: DecisionCardProps) {
  return (
    <div
      style={{
        padding: '14px 16px',
        border: `1px solid ${isPendingReview ? 'var(--error)' : 'var(--border-primary)'}`,
        borderRadius: '10px',
        background: isPendingReview ? 'rgba(255, 59, 48, 0.05)' : 'var(--bg-elevated)',
        marginBottom: '8px',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
      onClick={onView}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--accent)';
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = isPendingReview ? 'var(--error)' : 'var(--border-primary)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h4 style={{
            margin: '0 0 6px 0',
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {decision.question}
          </h4>
          <p style={{
            margin: '0 0 8px 0',
            fontSize: '13px',
            color: 'var(--text-secondary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            Decided: {decision.choice}
          </p>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontSize: '12px',
            color: 'var(--text-tertiary)',
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Calendar size={12} />
              {formatDate(decision.createdAt)}
            </span>
            {isReviewed ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {getOutcomeIcon(decision.outcomeRating)}
                {decision.outcomeRating ? decision.outcomeRating.charAt(0).toUpperCase() + decision.outcomeRating.slice(1) : 'No rating'}
              </span>
            ) : (
              <span style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                color: isPendingReview ? 'var(--error)' : 'var(--text-tertiary)',
              }}>
                <Clock size={12} />
                {isPendingReview
                  ? `${Math.abs(daysUntilReview)} days overdue`
                  : `Review in ${daysUntilReview} days`
                }
              </span>
            )}
          </div>
        </div>
        {isPendingReview && !isReviewed && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onReview();
            }}
            style={{
              padding: '8px 14px',
              fontSize: '12px',
              fontWeight: 600,
              border: 'none',
              borderRadius: '6px',
              background: 'var(--accent)',
              color: 'white',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--accent-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--accent)';
            }}
          >
            Review
          </button>
        )}
        {!isPendingReview && !isReviewed && (
          <ChevronRight size={16} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
        )}
      </div>
    </div>
  );
}
