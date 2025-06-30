"""
Text Summarization Plugin for ALEJO
Provides text summarization capabilities
"""
import re
import logging
import heapq
from typing import Dict, Any, List, Tuple
from collections import Counter

# Plugin metadata
PLUGIN_NAME = "text_summarizer"
PLUGIN_VERSION = "1.0.0"
PLUGIN_DESCRIPTION = "Text summarization for content processing"
PLUGIN_AUTHOR = "ALEJO Development Team"
PLUGIN_DEPENDENCIES = {"sentiment_analyzer": ">=1.0.0"}
PLUGIN_REQUIRES_ALEJO = "0.1.0"
PLUGIN_TAGS = ["nlp", "summarization", "text_processing", "content"]

logger = logging.getLogger(__name__)

class TextSummarizer:
    """
    Production-ready text summarization plugin that extracts key sentences
    from text to create concise summaries.
    """
    
    def __init__(self):
        self.stopwords = {
            'a', 'an', 'the', 'and', 'but', 'if', 'or', 'because', 'as', 'until', 
            'while', 'of', 'at', 'by', 'for', 'with', 'about', 'against', 'between',
            'into', 'through', 'during', 'before', 'after', 'above', 'below', 'to',
            'from', 'up', 'down', 'in', 'out', 'on', 'off', 'over', 'under', 'again',
            'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how',
            'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such',
            'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'can',
            'will', 'just', 'don', 'should', 'now', 'is', 'are', 'was', 'were', 'be', 'been',
            'being', 'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing'
        }
        
    def summarize(self, text: str, sentences_count: int = 3, min_length: int = 10) -> Dict[str, Any]:
        """
        Summarize the given text by extracting the most important sentences.
        
        Args:
            text: The text to summarize
            sentences_count: Number of sentences to include in the summary
            min_length: Minimum length of text (in words) required for summarization
            
        Returns:
            Dictionary containing the summary and metadata
        """
        if not text or not isinstance(text, str):
            return {
                'summary': '',
                'original_length': 0,
                'summary_length': 0,
                'reduction_percentage': 0,
                'error': 'Invalid input text'
            }
            
        # Clean and preprocess text
        cleaned_text = self._preprocess_text(text)
        
        # Split into sentences
        sentences = self._split_into_sentences(cleaned_text)
        
        # Check if text is long enough to summarize
        word_count = sum(len(sentence.split()) for sentence in sentences)
        if word_count < min_length or len(sentences) <= sentences_count:
            return {
                'summary': cleaned_text,
                'original_length': word_count,
                'summary_length': word_count,
                'reduction_percentage': 0,
                'note': 'Text too short for summarization'
            }
            
        # Calculate sentence scores
        sentence_scores = self._score_sentences(sentences)
        
        # Get top sentences
        top_sentences = self._get_top_sentences(sentences, sentence_scores, sentences_count)
        
        # Reconstruct summary in original order
        summary = ' '.join(top_sentences)
        summary_word_count = len(summary.split())
        
        reduction = round((1 - (summary_word_count / word_count)) * 100, 1)
        
        return {
            'summary': summary,
            'original_length': word_count,
            'summary_length': summary_word_count,
            'reduction_percentage': reduction,
            'sentence_count': len(top_sentences)
        }
        
    def _preprocess_text(self, text: str) -> str:
        """Clean and normalize text"""
        # Replace newlines with spaces
        text = re.sub(r'\n+', ' ', text)
        
        # Replace multiple spaces with single space
        text = re.sub(r'\s+', ' ', text)
        
        return text.strip()
        
    def _split_into_sentences(self, text: str) -> List[str]:
        """Split text into sentences"""
        # Simple sentence splitting by punctuation
        sentence_delimiters = r'[.!?]'
        sentences = re.split(sentence_delimiters, text)
        
        # Filter out empty sentences and strip whitespace
        return [sentence.strip() for sentence in sentences if sentence.strip()]
        
    def _score_sentences(self, sentences: List[str]) -> Dict[str, float]:
        """Score sentences based on word frequency"""
        # Get word frequencies
        word_frequencies = self._get_word_frequencies(sentences)
        
        # Calculate sentence scores
        sentence_scores = {}
        for sentence in sentences:
            for word in sentence.lower().split():
                if word in word_frequencies:
                    if sentence not in sentence_scores:
                        sentence_scores[sentence] = 0
                    sentence_scores[sentence] += word_frequencies[word]
                    
            # Normalize by sentence length to avoid bias towards longer sentences
            if sentence in sentence_scores and len(sentence.split()) > 0:
                sentence_scores[sentence] = sentence_scores[sentence] / len(sentence.split())
                
        return sentence_scores
        
    def _get_word_frequencies(self, sentences: List[str]) -> Dict[str, float]:
        """Calculate word frequencies excluding stopwords"""
        words = []
        for sentence in sentences:
            for word in sentence.lower().split():
                if word not in self.stopwords:
                    words.append(word)
                    
        # Count word frequencies
        word_counts = Counter(words)
        
        # Normalize frequencies
        max_frequency = max(word_counts.values()) if word_counts else 1
        word_frequencies = {word: count/max_frequency for word, count in word_counts.items()}
        
        return word_frequencies
        
    def _get_top_sentences(self, sentences: List[str], scores: Dict[str, float], count: int) -> List[str]:
        """Get top scoring sentences while preserving original order"""
        # Create (index, sentence, score) tuples
        indexed_sentences = [(i, sentence, scores.get(sentence, 0)) 
                             for i, sentence in enumerate(sentences)]
        
        # Sort by score (descending)
        sorted_sentences = sorted(indexed_sentences, key=lambda x: x[2], reverse=True)
        
        # Take top N sentences
        top_n = sorted_sentences[:count]
        
        # Sort back by original index to maintain document flow
        ordered_top = sorted(top_n, key=lambda x: x[0])
        
        # Extract just the sentences
        return [sentence for _, sentence, _ in ordered_top]
        
    def process(self, text: str, sentences_count: int = 3) -> Dict[str, Any]:
        """
        Process text for summarization (alias for summarize).
        
        Args:
            text: The text to summarize
            sentences_count: Number of sentences to include
            
        Returns:
            Dictionary containing the summary and metadata
        """
        return self.summarize(text, sentences_count)
        
    def execute(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute the plugin with the given parameters.
        
        Args:
            params: Dictionary containing parameters, must include 'text'
            
        Returns:
            Dictionary containing the summary and metadata
        """
        if 'text' not in params:
            return {'error': 'Missing required parameter: text'}
            
        sentences_count = params.get('sentences_count', 3)
        return self.summarize(params['text'], sentences_count)


# Plugin registration function
def register():
    """Return a plugin instance when the plugin is loaded"""
    return TextSummarizer()
