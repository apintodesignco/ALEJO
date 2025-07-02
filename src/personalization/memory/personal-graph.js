/**
 * personal-graph.js
 * Tracks important people, places, and preferences.
 */
import { publish } from '../../core/events.js';

// Simple in-memory graph
const nodes = new Map(); // id -> { type, properties }
const edges = []; // { from, to, relation }

/**
 * Add or update a node in the graph.
 * @param {string} id
 * @param {string} type
 * @param {Object} properties
 */
export function upsertNode(id, type, properties={}) {
  const existing = nodes.get(id) || { type, properties: {} };
  existing.type = type;
  existing.properties = { ...existing.properties, ...properties };
  nodes.set(id, existing);
  publish('memory:node-upserted', { id, node: existing });
}

/**
 * Add an edge between nodes.
 * @param {string} from
 * @param {string} to
 * @param {string} relation
 */
export function addEdge(from, to, relation) {
  edges.push({ from, to, relation });
  publish('memory:edge-added', { from, to, relation });
}

/**
 * Retrieve a node by id.
 * @param {string} id
 */
export function getNode(id) {
  return nodes.get(id);
}

/**
 * Retrieve all edges for a node.
 * @param {string} id
 */
export function getEdges(id) {
  return edges.filter(e => e.from===id || e.to===id);
}

/**
 * Get full graph snapshot.
 */
export function getGraph() {
  return { nodes: Array.from(nodes.entries()), edges };
}
