/**
 * TicketManager Component
 *
 * Integrated ticket/issue tracking system for the Music Analyzer.
 * Tracks bugs, feature requests, and improvements with database persistence.
 */

import React, { useState, useEffect, useCallback } from 'react';

const API_BASE = 'http://localhost:56404/api';

const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];
const STATUSES = ['OPEN', 'IN_PROGRESS', 'REVIEW', 'RESOLVED', 'WONTFIX'];
const COMPONENTS = [
  'Chord Detection',
  'Rhythm Detection',
  'Grid/Timeline',
  'Audio Analysis',
  'Stem Separation',
  'MIDI Export',
  'UI/UX',
  'Performance',
  'API/Backend',
  'General'
];

const STATUS_COLORS = {
  OPEN: '#f59e0b',
  IN_PROGRESS: '#3b82f6',
  REVIEW: '#8b5cf6',
  RESOLVED: '#10b981',
  WONTFIX: '#6b7280'
};

const PRIORITY_COLORS = {
  Critical: '#ef4444',
  High: '#f97316',
  Medium: '#eab308',
  Low: '#22c55e'
};

function TicketManager({ isOpen, onClose }) {
  const [tickets, setTickets] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [filter, setFilter] = useState({ status: '', priority: '', component: '' });
  const [newNote, setNewNote] = useState('');

  // Form state for new ticket
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'Medium',
    component: 'General',
    steps: '',
    expected: '',
    actual: ''
  });

  // Fetch tickets
  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filter.status) params.append('status', filter.status);
      if (filter.priority) params.append('priority', filter.priority);
      if (filter.component) params.append('component', filter.component);

      const response = await fetch(`${API_BASE}/tickets?${params}`);
      const data = await response.json();
      setTickets(data.tickets || []);
      setError(null);
    } catch (err) {
      setError('Failed to load tickets');
      console.error('Fetch tickets error:', err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/tickets/stats/summary`);
      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error('Fetch stats error:', err);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchTickets();
      fetchStats();
    }
  }, [isOpen, fetchTickets, fetchStats]);

  // Create ticket
  const handleCreateTicket = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_BASE}/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const ticket = await response.json();
        setTickets(prev => [ticket, ...prev]);
        setShowCreateForm(false);
        setFormData({
          title: '',
          description: '',
          priority: 'Medium',
          component: 'General',
          steps: '',
          expected: '',
          actual: ''
        });
        fetchStats();
      }
    } catch (err) {
      setError('Failed to create ticket');
    }
  };

  // Update ticket status
  const handleUpdateStatus = async (ticketId, newStatus) => {
    try {
      const response = await fetch(`${API_BASE}/tickets/${ticketId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        const updated = await response.json();
        setTickets(prev => prev.map(t => t.id === ticketId ? updated : t));
        if (selectedTicket?.id === ticketId) {
          setSelectedTicket(updated);
        }
        fetchStats();
      }
    } catch (err) {
      setError('Failed to update ticket');
    }
  };

  // Add note
  const handleAddNote = async () => {
    if (!newNote.trim() || !selectedTicket) return;

    try {
      const response = await fetch(`${API_BASE}/tickets/${selectedTicket.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: newNote })
      });

      if (response.ok) {
        const updated = await response.json();
        setTickets(prev => prev.map(t => t.id === selectedTicket.id ? updated : t));
        setSelectedTicket(updated);
        setNewNote('');
      }
    } catch (err) {
      setError('Failed to add note');
    }
  };

  // Delete ticket
  const handleDeleteTicket = async (ticketId) => {
    if (!window.confirm('Delete this ticket?')) return;

    try {
      const response = await fetch(`${API_BASE}/tickets/${ticketId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setTickets(prev => prev.filter(t => t.id !== ticketId));
        if (selectedTicket?.id === ticketId) {
          setSelectedTicket(null);
        }
        fetchStats();
      }
    } catch (err) {
      setError('Failed to delete ticket');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="ticket-manager-overlay">
      <div className="ticket-manager">
        <div className="ticket-header">
          <h2>Issue Tracker</h2>
          <div className="ticket-header-actions">
            <button className="btn-create" onClick={() => setShowCreateForm(true)}>
              + New Ticket
            </button>
            <button className="btn-close" onClick={onClose}>X</button>
          </div>
        </div>

        {/* Stats Bar */}
        {stats && (
          <div className="ticket-stats">
            <div className="stat-item">
              <span className="stat-value">{stats.open}</span>
              <span className="stat-label">Open</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{stats.inProgress}</span>
              <span className="stat-label">In Progress</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{stats.resolved}</span>
              <span className="stat-label">Resolved</span>
            </div>
            <div className="stat-item critical">
              <span className="stat-value">{stats.byPriority?.Critical || 0}</span>
              <span className="stat-label">Critical</span>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="ticket-filters">
          <select
            value={filter.status}
            onChange={(e) => setFilter(prev => ({ ...prev, status: e.target.value }))}
          >
            <option value="">All Statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            value={filter.priority}
            onChange={(e) => setFilter(prev => ({ ...prev, priority: e.target.value }))}
          >
            <option value="">All Priorities</option>
            {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select
            value={filter.component}
            onChange={(e) => setFilter(prev => ({ ...prev, component: e.target.value }))}
          >
            <option value="">All Components</option>
            {COMPONENTS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button onClick={() => setFilter({ status: '', priority: '', component: '' })}>
            Clear
          </button>
        </div>

        <div className="ticket-content">
          {/* Ticket List */}
          <div className="ticket-list">
            {loading && <div className="loading">Loading tickets...</div>}
            {error && <div className="error">{error}</div>}
            {!loading && tickets.length === 0 && (
              <div className="empty">No tickets found</div>
            )}
            {tickets.map(ticket => (
              <div
                key={ticket.id}
                className={`ticket-item ${selectedTicket?.id === ticket.id ? 'selected' : ''}`}
                onClick={() => setSelectedTicket(ticket)}
              >
                <div className="ticket-item-header">
                  <span className="ticket-id">{ticket.id}</span>
                  <span
                    className="ticket-status"
                    style={{ backgroundColor: STATUS_COLORS[ticket.status] }}
                  >
                    {ticket.status}
                  </span>
                </div>
                <div className="ticket-title">{ticket.title}</div>
                <div className="ticket-meta">
                  <span
                    className="ticket-priority"
                    style={{ color: PRIORITY_COLORS[ticket.priority] }}
                  >
                    {ticket.priority}
                  </span>
                  <span className="ticket-component">{ticket.component}</span>
                  <span className="ticket-date">{ticket.created}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Ticket Detail */}
          {selectedTicket && (
            <div className="ticket-detail">
              <div className="ticket-detail-header">
                <h3>{selectedTicket.id}: {selectedTicket.title}</h3>
                <button
                  className="btn-delete"
                  onClick={() => handleDeleteTicket(selectedTicket.id)}
                >
                  Delete
                </button>
              </div>

              <div className="ticket-detail-info">
                <div className="info-row">
                  <label>Status:</label>
                  <select
                    value={selectedTicket.status}
                    onChange={(e) => handleUpdateStatus(selectedTicket.id, e.target.value)}
                  >
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="info-row">
                  <label>Priority:</label>
                  <span style={{ color: PRIORITY_COLORS[selectedTicket.priority] }}>
                    {selectedTicket.priority}
                  </span>
                </div>
                <div className="info-row">
                  <label>Component:</label>
                  <span>{selectedTicket.component}</span>
                </div>
                <div className="info-row">
                  <label>Created:</label>
                  <span>{selectedTicket.created}</span>
                </div>
              </div>

              {selectedTicket.description && (
                <div className="ticket-section">
                  <h4>Description</h4>
                  <p>{selectedTicket.description}</p>
                </div>
              )}

              {selectedTicket.steps && (
                <div className="ticket-section">
                  <h4>Steps to Reproduce</h4>
                  <p>{selectedTicket.steps}</p>
                </div>
              )}

              {(selectedTicket.expected || selectedTicket.actual) && (
                <div className="ticket-section">
                  <h4>Expected vs Actual</h4>
                  {selectedTicket.expected && <p><strong>Expected:</strong> {selectedTicket.expected}</p>}
                  {selectedTicket.actual && <p><strong>Actual:</strong> {selectedTicket.actual}</p>}
                </div>
              )}

              {selectedTicket.rootCause && (
                <div className="ticket-section">
                  <h4>Root Cause</h4>
                  <p>{selectedTicket.rootCause}</p>
                </div>
              )}

              {selectedTicket.resolution && (
                <div className="ticket-section resolution">
                  <h4>Resolution</h4>
                  <p>{selectedTicket.resolution}</p>
                  {selectedTicket.resolved && (
                    <span className="resolved-date">Resolved: {selectedTicket.resolved}</span>
                  )}
                </div>
              )}

              {/* Notes */}
              <div className="ticket-section">
                <h4>Notes ({selectedTicket.notes?.length || 0})</h4>
                <div className="notes-list">
                  {selectedTicket.notes?.map((note, i) => (
                    <div key={i} className="note-item">
                      <span className="note-time">
                        {new Date(note.timestamp).toLocaleString()}
                      </span>
                      <p>{note.text}</p>
                    </div>
                  ))}
                </div>
                <div className="add-note">
                  <textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Add a note..."
                  />
                  <button onClick={handleAddNote} disabled={!newNote.trim()}>
                    Add Note
                  </button>
                </div>
              </div>
            </div>
          )}

          {!selectedTicket && !showCreateForm && (
            <div className="ticket-placeholder">
              Select a ticket to view details or create a new one
            </div>
          )}
        </div>

        {/* Create Form Modal */}
        {showCreateForm && (
          <div className="create-form-overlay">
            <form className="create-form" onSubmit={handleCreateTicket}>
              <h3>Create New Ticket</h3>

              <div className="form-group">
                <label>Title *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value }))}
                  >
                    {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Component</label>
                  <select
                    value={formData.component}
                    onChange={(e) => setFormData(prev => ({ ...prev, component: e.target.value }))}
                  >
                    {COMPONENTS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                />
              </div>

              <div className="form-group">
                <label>Steps to Reproduce</label>
                <textarea
                  value={formData.steps}
                  onChange={(e) => setFormData(prev => ({ ...prev, steps: e.target.value }))}
                  rows={2}
                  placeholder="1. Step one&#10;2. Step two"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Expected Behavior</label>
                  <input
                    type="text"
                    value={formData.expected}
                    onChange={(e) => setFormData(prev => ({ ...prev, expected: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label>Actual Behavior</label>
                  <input
                    type="text"
                    value={formData.actual}
                    onChange={(e) => setFormData(prev => ({ ...prev, actual: e.target.value }))}
                  />
                </div>
              </div>

              <div className="form-actions">
                <button type="button" onClick={() => setShowCreateForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Create Ticket
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

// Mini badge for header showing open ticket count
export function TicketBadge({ count, onClick }) {
  if (count === 0) return null;

  return (
    <button className="ticket-badge" onClick={onClick}>
      {count} {count === 1 ? 'Issue' : 'Issues'}
    </button>
  );
}

export default TicketManager;
