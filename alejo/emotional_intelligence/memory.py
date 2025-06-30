"""
Emotional Memory Module for ALEJO

Handles storage and retrieval of emotional context, relationship data,
and interaction history to inform emotional responses and maintain continuity.
"""

import sqlite3
from typing import Dict, List, Optional, Any
import numpy as np
from scipy import stats
from typing import Dict, List, Optional, Any, Tuple
import json
import logging
from datetime import datetime
from pathlib import Path

logger = logging.getLogger(__name__)

class EmotionalMemoryService:
    def __init__(self, config: Dict[str, Any] = None):
        """Initialize emotional memory with database connection"""
        self.config = config or {}
        db_path = Path(self.config.get('db_path', 'alejo_data.db'))
        self.db_path = db_path
        self._init_database()
        logger.info("Emotional Memory initialized")

    def _init_database(self):
        """Initialize the database schema for emotional memory"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            # Create emotional interactions table with expanded emotional dimensions
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS emotional_interactions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    interaction_type TEXT NOT NULL,
                    emotional_valence REAL,
                    emotional_arousal REAL,
                    emotional_dominance REAL,
                    emotional_social REAL,
                    emotional_moral REAL,
                    emotional_temporal REAL,
                    context TEXT,
                    response TEXT,
                    trigger TEXT,
                    confidence REAL
                )
            ''')
            
            # Create relationship metrics table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS relationship_metrics (
                    user_id TEXT PRIMARY KEY,
                    trust_level REAL DEFAULT 0.5,
                    rapport_level REAL DEFAULT 0.5,
                    interaction_count INTEGER DEFAULT 0,
                    last_interaction TEXT,
                    preferences TEXT
                )
            ''')
            
            # Create emotional context table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS emotional_context (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id TEXT NOT NULL,
                    context_type TEXT NOT NULL,
                    context_data TEXT NOT NULL,
                    timestamp TEXT NOT NULL
                )
            ''')
            
            # Create emotional state summaries table for long-term tracking
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS emotional_state_summaries (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id TEXT NOT NULL,
                    date TEXT NOT NULL,  -- YYYY-MM-DD format
                    dominant_emotions TEXT NOT NULL,  -- JSON array of top emotions
                    average_valence REAL,
                    average_arousal REAL,
                    average_dominance REAL,
                    average_social REAL,
                    average_moral REAL,
                    average_temporal REAL,
                    interaction_count INTEGER,
                    notable_triggers TEXT,  -- JSON array of significant emotional triggers
                    emotional_stability REAL,  -- measure of emotional variability
                    UNIQUE(user_id, date)
                )
            ''')
            
            # Create emotional patterns table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS emotional_patterns (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id TEXT NOT NULL,
                    pattern_type TEXT NOT NULL,  -- e.g., 'trigger', 'cyclic', 'trend'
                    pattern_data TEXT NOT NULL,  -- JSON object with pattern details
                    confidence REAL,
                    first_observed TEXT NOT NULL,
                    last_observed TEXT NOT NULL,
                    occurrence_count INTEGER,
                    active BOOLEAN DEFAULT 1
                )
            ''')
            
            conn.commit()

    def store_interaction(self, user_id: str, interaction_type: str, 
                         emotional_data: Dict[str, float], context: Dict[str, Any],
                         response: str, trigger: Optional[str] = None,
                         confidence: Optional[float] = None) -> None:
        """Store an emotional interaction in the database with expanded emotional dimensions"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO emotional_interactions 
                (timestamp, user_id, interaction_type, emotional_valence, 
                 emotional_arousal, emotional_dominance, emotional_social,
                 emotional_moral, emotional_temporal, context, response,
                 trigger, confidence)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                datetime.now().isoformat(),
                user_id,
                interaction_type,
                emotional_data.get('valence', 0.0),
                emotional_data.get('arousal', 0.0),
                emotional_data.get('dominance', 0.0),
                emotional_data.get('social', 0.0),
                emotional_data.get('moral', 0.0),
                emotional_data.get('temporal', 0.0),
                json.dumps(context),
                response,
                trigger,
                confidence if confidence is not None else 1.0
            ))
            
            # After storing the interaction, update the daily summary
            self._update_daily_summary(user_id)
            
            # Check for and update emotional patterns
            self._analyze_and_store_patterns(user_id)
            
            conn.commit()

    def update_relationship_metrics(self, user_id: str, 
                                 trust_delta: float = 0.0,
                                 rapport_delta: float = 0.0) -> None:
        """Update relationship metrics for a user"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            # Get current metrics or insert new ones
            cursor.execute('''
                INSERT OR IGNORE INTO relationship_metrics (user_id)
                VALUES (?)
            ''', (user_id,))
            
            # Update metrics
            cursor.execute('''
                UPDATE relationship_metrics
                SET trust_level = ROUND(MIN(MAX(trust_level + ?, 0), 1), 3),
                    rapport_level = ROUND(MIN(MAX(rapport_level + ?, 0), 1), 3),
                    interaction_count = interaction_count + 1,
                    last_interaction = ?
                WHERE user_id = ?
            ''', (
                trust_delta,
                rapport_delta,
                datetime.now().isoformat(),
                user_id
            ))
            conn.commit()

    def get_relationship_context(self, user_id: str) -> Dict[str, Any]:
        """Get relationship context for a user"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT trust_level, rapport_level, interaction_count,
                       last_interaction, preferences
                FROM relationship_metrics
                WHERE user_id = ?
            ''', (user_id,))
            
            row = cursor.fetchone()
            if row:
                return {
                    'trust_level': row[0],
                    'rapport_level': row[1],
                    'interaction_count': row[2],
                    'last_interaction': row[3],
                    'preferences': json.loads(row[4]) if row[4] else {}
                }
            return {
                'trust_level': 0.5,
                'rapport_level': 0.5,
                'interaction_count': 0,
                'last_interaction': None,
                'preferences': {}
            }

    def store_emotional_context(self, user_id: str, context_type: str,
                              context_data: Dict[str, Any]) -> None:
        """Store emotional context for a user"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO emotional_context
                (user_id, context_type, context_data, timestamp)
                VALUES (?, ?, ?, ?)
            ''', (
                user_id,
                context_type,
                json.dumps(context_data),
                datetime.now().isoformat()
            ))
            conn.commit()

    def get_recent_interactions(self, user_id: str, limit: int = 5) -> List[Dict[str, Any]]:
        """Get recent emotional interactions for a user"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT timestamp, interaction_type, emotional_valence,
                       emotional_arousal, emotional_dominance, context, response
                FROM emotional_interactions
                WHERE user_id = ?
                ORDER BY timestamp DESC
                LIMIT ?
            ''', (user_id, limit))
            
            interactions = []
            for row in cursor.fetchall():
                interactions.append({
                    'timestamp': row[0],
                    'interaction_type': row[1],
                    'emotional_data': {
                        'valence': row[2],
                        'arousal': row[3],
                        'dominance': row[4]
                    },
                    'context': json.loads(row[5]) if row[5] else {},
                    'response': row[6]
                })
            return interactions

    def get_emotional_context(self, user_id: str, 
                            context_type: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get emotional context for a user"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            if context_type:
                cursor.execute('''
                    SELECT context_type, context_data, timestamp
                    FROM emotional_context
                    WHERE user_id = ? AND context_type = ?
                    ORDER BY timestamp DESC
                ''', (user_id, context_type))
            else:
                cursor.execute('''
                    SELECT context_type, context_data, timestamp
                    FROM emotional_context
                    WHERE user_id = ?
                    ORDER BY timestamp DESC
                ''', (user_id,))
            
            context_list = []
            for row in cursor.fetchall():
                context_list.append({
                    'context_type': row[0],
                    'context_data': json.loads(row[1]),
                    'timestamp': row[2]
                })
            return context_list

    def _update_daily_summary(self, user_id: str) -> None:
        """Update or create daily emotional state summary"""
        today = datetime.now().strftime('%Y-%m-%d')
        
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            # Get all interactions for today
            cursor.execute('''
                SELECT emotional_valence, emotional_arousal, emotional_dominance,
                       emotional_social, emotional_moral, emotional_temporal,
                       trigger, confidence
                FROM emotional_interactions
                WHERE user_id = ? AND date(timestamp) = ?
            ''', (user_id, today))
            
            interactions = cursor.fetchall()
            if not interactions:
                return
            
            # Calculate averages and collect triggers
            interaction_count = len(interactions)
            avg_valence = sum(i[0] * i[7] for i in interactions) / sum(i[7] for i in interactions)
            avg_arousal = sum(i[1] * i[7] for i in interactions) / sum(i[7] for i in interactions)
            avg_dominance = sum(i[2] * i[7] for i in interactions) / sum(i[7] for i in interactions)
            avg_social = sum(i[3] * i[7] for i in interactions) / sum(i[7] for i in interactions)
            avg_moral = sum(i[4] * i[7] for i in interactions) / sum(i[7] for i in interactions)
            avg_temporal = sum(i[5] * i[7] for i in interactions) / sum(i[7] for i in interactions)
            
            # Calculate emotional stability (inverse of standard deviation)
            valence_stability = 1.0 - (np.std([i[0] for i in interactions]) if len(interactions) > 1 else 0.0)
            
            # Collect and analyze triggers
            triggers = [i[6] for i in interactions if i[6]]
            trigger_counts = {}
            for trigger in triggers:
                trigger_counts[trigger] = trigger_counts.get(trigger, 0) + 1
            
            # Get top triggers (those occurring more than average)
            avg_trigger_count = len(triggers) / len(trigger_counts) if trigger_counts else 0
            notable_triggers = [
                trigger for trigger, count in trigger_counts.items()
                if count > avg_trigger_count
            ]
            
            # Determine dominant emotions by analyzing the day's interactions
            cursor.execute('''
                SELECT interaction_type, COUNT(*) as count
                FROM emotional_interactions
                WHERE user_id = ? AND date(timestamp) = ?
                GROUP BY interaction_type
                ORDER BY count DESC
                LIMIT 3
            ''', (user_id, today))
            
            dominant_emotions = [row[0] for row in cursor.fetchall()]
            
            # Update or insert daily summary
            cursor.execute('''
                INSERT OR REPLACE INTO emotional_state_summaries
                (user_id, date, dominant_emotions, average_valence,
                 average_arousal, average_dominance, average_social,
                 average_moral, average_temporal, interaction_count,
                 notable_triggers, emotional_stability)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                user_id,
                today,
                json.dumps(dominant_emotions),
                avg_valence,
                avg_arousal,
                avg_dominance,
                avg_social,
                avg_moral,
                avg_temporal,
                interaction_count,
                json.dumps(notable_triggers),
                valence_stability
            ))
            
            conn.commit()
    
    def _analyze_and_store_patterns(self, user_id: str) -> None:
        """Analyze emotional data to identify and store patterns"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            # Get emotional state summaries for pattern analysis
            cursor.execute('''
                SELECT date, average_valence, average_arousal, average_dominance,
                       average_social, average_moral, average_temporal,
                       emotional_stability, notable_triggers
                FROM emotional_state_summaries
                WHERE user_id = ?
                ORDER BY date ASC
            ''', (user_id,))
            
            summaries = cursor.fetchall()
            if len(summaries) < 3:  # Need at least 3 days for pattern analysis
                return
            
            # Analyze trends in emotional dimensions
            dimensions = ['valence', 'arousal', 'dominance', 'social', 'moral', 'temporal']
            for i, dim in enumerate(dimensions, start=1):
                values = [summary[i] for summary in summaries]
                slope, _, r_value, p_value, _ = stats.linregress(range(len(values)), values)
                
                if p_value < 0.05 and abs(r_value) > 0.5:  # Significant trend
                    pattern_data = {
                        'dimension': dim,
                        'slope': slope,
                        'r_value': r_value,
                        'duration_days': len(values)
                    }
                    
                    self._store_pattern(
                        cursor, user_id, 'trend',
                        pattern_data, abs(r_value),
                        summaries[0][0], summaries[-1][0]
                    )
            
            # Analyze trigger patterns
            all_triggers = []
            for summary in summaries:
                triggers = json.loads(summary[8]) if summary[8] else []
                all_triggers.extend(triggers)
            
            trigger_counts = {}
            for trigger in all_triggers:
                trigger_counts[trigger] = trigger_counts.get(trigger, 0) + 1
            
            # Identify significant triggers (occurring in >25% of days)
            significant_threshold = len(summaries) * 0.25
            for trigger, count in trigger_counts.items():
                if count >= significant_threshold:
                    # Analyze emotional response to this trigger
                    cursor.execute('''
                        SELECT AVG(emotional_valence), AVG(emotional_arousal),
                               AVG(emotional_dominance), COUNT(*)
                        FROM emotional_interactions
                        WHERE user_id = ? AND trigger = ?
                    ''', (user_id, trigger))
                    
                    avg_v, avg_a, avg_d, trigger_count = cursor.fetchone()
                    pattern_data = {
                        'trigger': trigger,
                        'avg_response': {
                            'valence': avg_v,
                            'arousal': avg_a,
                            'dominance': avg_d
                        },
                        'occurrence_count': trigger_count
                    }
                    
                    self._store_pattern(
                        cursor, user_id, 'trigger',
                        pattern_data, count/len(summaries),
                        summaries[0][0], summaries[-1][0]
                    )
            
            # Analyze cyclic patterns (e.g., daily, weekly variations)
            for dim in dimensions:
                values = [summary[dimensions.index(dim) + 1] for summary in summaries]
                if len(values) >= 7:  # Need at least a week of data
                    # Check for daily cycles
                    daily_autocorr = self._calculate_autocorrelation(values, 1)
                    # Check for weekly cycles
                    weekly_autocorr = self._calculate_autocorrelation(values, 7)
                    
                    if daily_autocorr > 0.6 or weekly_autocorr > 0.6:
                        pattern_data = {
                            'dimension': dim,
                            'daily_cycle': daily_autocorr > 0.6,
                            'weekly_cycle': weekly_autocorr > 0.6,
                            'daily_correlation': daily_autocorr,
                            'weekly_correlation': weekly_autocorr
                        }
                        
                        self._store_pattern(
                            cursor, user_id, 'cyclic',
                            pattern_data, max(daily_autocorr, weekly_autocorr),
                            summaries[0][0], summaries[-1][0]
                        )
            
            conn.commit()
    
    def _calculate_autocorrelation(self, values: List[float], lag: int) -> float:
        """Calculate autocorrelation of a time series at given lag"""
        series = np.array(values)
        n = len(series)
        if n <= lag:
            return 0.0
        
        # Calculate autocorrelation
        mean = np.mean(series)
        var = np.var(series)
        if var == 0:
            return 0.0
            
        autocorr = np.correlate(series - mean, series - mean, mode='full')[n-1:]
        autocorr = autocorr / (var * n)
        
        return autocorr[lag] if lag < len(autocorr) else 0.0
    
    def _store_pattern(self, cursor: sqlite3.Cursor, user_id: str,
                      pattern_type: str, pattern_data: Dict[str, Any],
                      confidence: float, first_observed: str,
                      last_observed: str) -> None:
        """Store or update an emotional pattern"""
        pattern_key = f"{pattern_type}:{json.dumps(pattern_data, sort_keys=True)}"
        
        # Check if pattern exists
        cursor.execute('''
            SELECT id, occurrence_count
            FROM emotional_patterns
            WHERE user_id = ? AND pattern_type = ? AND
                  pattern_data = ? AND active = 1
        ''', (user_id, pattern_type, json.dumps(pattern_data)))
        
        existing = cursor.fetchone()
        if existing:
            # Update existing pattern
            cursor.execute('''
                UPDATE emotional_patterns
                SET confidence = ?,
                    last_observed = ?,
                    occurrence_count = ?
                WHERE id = ?
            ''', (
                confidence,
                last_observed,
                existing[1] + 1,
                existing[0]
            ))
        else:
            # Insert new pattern
            cursor.execute('''
                INSERT INTO emotional_patterns
                (user_id, pattern_type, pattern_data, confidence,
                 first_observed, last_observed, occurrence_count)
                VALUES (?, ?, ?, ?, ?, ?, 1)
            ''', (
                user_id,
                pattern_type,
                json.dumps(pattern_data),
                confidence,
                first_observed,
                last_observed
            ))
    
    def get_emotional_summary(self, user_id: str, days: int = 7) -> Dict[str, Any]:
        """Get emotional state summary for a user over the specified number of days"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            # Get daily summaries for the specified period
            cursor.execute('''
                SELECT date, dominant_emotions, average_valence,
                       average_arousal, average_dominance, average_social,
                       average_moral, average_temporal, interaction_count,
                       notable_triggers, emotional_stability
                FROM emotional_state_summaries
                WHERE user_id = ?
                ORDER BY date DESC
                LIMIT ?
            ''', (user_id, days))
            
            summaries = cursor.fetchall()
            if not summaries:
                return {}
            
            # Calculate overall averages and trends
            avg_dimensions = {
                'valence': np.mean([s[2] for s in summaries]),
                'arousal': np.mean([s[3] for s in summaries]),
                'dominance': np.mean([s[4] for s in summaries]),
                'social': np.mean([s[5] for s in summaries]),
                'moral': np.mean([s[6] for s in summaries]),
                'temporal': np.mean([s[7] for s in summaries])
            }
            
            # Collect all dominant emotions and triggers
            all_emotions = []
            all_triggers = []
            for summary in summaries:
                emotions = json.loads(summary[1])
                triggers = json.loads(summary[9]) if summary[9] else []
                all_emotions.extend(emotions)
                all_triggers.extend(triggers)
            
            # Get most frequent emotions and triggers
            emotion_counts = {}
            trigger_counts = {}
            for emotion in all_emotions:
                emotion_counts[emotion] = emotion_counts.get(emotion, 0) + 1
            for trigger in all_triggers:
                trigger_counts[trigger] = trigger_counts.get(trigger, 0) + 1
            
            top_emotions = sorted(emotion_counts.items(), key=lambda x: x[1], reverse=True)[:3]
            top_triggers = sorted(trigger_counts.items(), key=lambda x: x[1], reverse=True)[:3]
            
            # Calculate emotional stability trend
            stability_trend = np.mean([s[10] for s in summaries])
            
            return {
                'period': {
                    'start_date': summaries[-1][0],
                    'end_date': summaries[0][0],
                    'total_days': len(summaries)
                },
                'emotional_state': {
                    'dominant_emotions': [e[0] for e in top_emotions],
                    'averages': avg_dimensions,
                    'stability': stability_trend
                },
                'triggers': {
                    'most_frequent': [t[0] for t in top_triggers],
                    'frequency': {t[0]: t[1]/len(summaries) for t in top_triggers}
                },
                'daily_summaries': [{
                    'date': s[0],
                    'emotions': json.loads(s[1]),
                    'dimensions': {
                        'valence': s[2],
                        'arousal': s[3],
                        'dominance': s[4],
                        'social': s[5],
                        'moral': s[6],
                        'temporal': s[7]
                    },
                    'interaction_count': s[8],
                    'triggers': json.loads(s[9]) if s[9] else [],
                    'stability': s[10]
                } for s in summaries]
            }
    
    def get_emotional_patterns(self, user_id: str,
                             pattern_types: Optional[List[str]] = None,
                             min_confidence: float = 0.5) -> List[Dict[str, Any]]:
        """Get emotional patterns for a user
        
        Args:
            user_id: The user's ID
            pattern_types: Optional list of pattern types to filter by ('trend', 'trigger', 'cyclic')
            min_confidence: Minimum confidence threshold for patterns (0-1)
            
        Returns:
            List of emotional patterns with their details
        """
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            query = '''
                SELECT pattern_type, pattern_data, confidence,
                       first_observed, last_observed, occurrence_count
                FROM emotional_patterns
                WHERE user_id = ? AND active = 1
                  AND confidence >= ?
            '''
            params = [user_id, min_confidence]
            
            if pattern_types:
                placeholders = ','.join('?' * len(pattern_types))
                query += f' AND pattern_type IN ({placeholders})'
                params.extend(pattern_types)
            
            query += ' ORDER BY confidence DESC'
            cursor.execute(query, params)
            
            patterns = cursor.fetchall()
            return [{
                'type': p[0],
                'data': json.loads(p[1]),
                'confidence': p[2],
                'first_observed': p[3],
                'last_observed': p[4],
                'occurrence_count': p[5]
            } for p in patterns]
    
    def get_nostalgic_memories(self, trigger: str, limit: int = 5) -> List[Dict[str, Any]]:
        """Get memories associated with a nostalgic trigger
        
        Args:
            trigger: The trigger to search for
            limit: Maximum number of memories to return
            
        Returns:
            List of memories with their emotional dimensions and context
        """
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            # Find interactions with this trigger that had high temporal dimension
            # (indicating past-focused emotions) and positive valence
            cursor.execute('''
                SELECT timestamp, emotional_valence, emotional_arousal,
                       emotional_dominance, emotional_social, emotional_moral,
                       emotional_temporal, context, response
                FROM emotional_interactions
                WHERE trigger = ? AND emotional_temporal > 0.6
                  AND emotional_valence > 0.5
                ORDER BY emotional_valence * emotional_temporal DESC
                LIMIT ?
            ''', (trigger, limit))
            
            memories = cursor.fetchall()
            return [{
                'timestamp': m[0],
                'dimensions': {
                    'valence': m[1],
                    'arousal': m[2],
                    'dominance': m[3],
                    'social': m[4],
                    'moral': m[5],
                    'temporal': m[6]
                },
                'context': json.loads(m[7]),
                'response': m[8]
            } for m in memories]
    
    def get_similar_memories(self, trigger: str, context: Dict[str, str],
                           limit: int = 5) -> List[Dict[str, Any]]:
        """Get memories with similar triggers or context
        
        Args:
            trigger: The trigger to search for
            context: The current context dictionary
            limit: Maximum number of memories to return
            
        Returns:
            List of similar memories with their emotional dimensions
        """
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            # Find interactions with exact trigger match first
            cursor.execute('''
                SELECT timestamp, emotional_valence, emotional_arousal,
                       emotional_dominance, emotional_social, emotional_moral,
                       emotional_temporal, context, response, confidence
                FROM emotional_interactions
                WHERE trigger = ?
                ORDER BY timestamp DESC
                LIMIT ?
            ''', (trigger, limit))
            
            exact_matches = cursor.fetchall()
            
            # Then find interactions with similar context
            context_values = tuple(context.values())
            if context_values:
                placeholders = ','.join(['?' for _ in context_values])
                cursor.execute(f'''
                    SELECT timestamp, emotional_valence, emotional_arousal,
                           emotional_dominance, emotional_social, emotional_moral,
                           emotional_temporal, context, response, confidence
                    FROM emotional_interactions
                    WHERE json_extract(context, '$.*') IN ({placeholders})
                      AND trigger != ?
                    ORDER BY timestamp DESC
                    LIMIT ?
                ''', (*context_values, trigger, limit - len(exact_matches)))
                
                context_matches = cursor.fetchall()
            else:
                context_matches = []
            
            all_matches = exact_matches + context_matches
            return [{
                'timestamp': m[0],
                'dimensions': {
                    'valence': m[1],
                    'arousal': m[2],
                    'dominance': m[3],
                    'social': m[4],
                    'moral': m[5],
                    'temporal': m[6]
                },
                'context': json.loads(m[7]),
                'response': m[8],
                'confidence': m[9],
                'match_type': 'trigger' if m in exact_matches else 'context'
            } for m in all_matches]
    
    def clear_user_data(self, user_id: str) -> None:
        """Clear all emotional data for a user"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('DELETE FROM emotional_interactions WHERE user_id = ?', (user_id,))
            cursor.execute('DELETE FROM relationship_metrics WHERE user_id = ?', (user_id,))
            cursor.execute('DELETE FROM emotional_context WHERE user_id = ?', (user_id,))
            cursor.execute('DELETE FROM emotional_state_summaries WHERE user_id = ?', (user_id,))
            cursor.execute('DELETE FROM emotional_patterns WHERE user_id = ?', (user_id,))
            conn.commit()
