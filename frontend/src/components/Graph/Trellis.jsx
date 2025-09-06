import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useResizeDetector } from 'react-resize-detector';
import { getSelectionBounds, boundsToViewport } from '@sayari/trellis';
import * as Force from '@sayari/trellis/layout/force';
import { Renderer } from '@sayari/trellis/bindings/react/renderer';
import { Selection } from '@sayari/trellis/bindings/react/selection';
import { getSocket } from '../../services/socket';
import { concatSet, styleNode } from './util';
import Button from '@mui/material/Button';
import RefreshIcon from '@mui/icons-material/Refresh';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';

const force = Force.Layout();

const Graph = ({ onNodeClick, colorMode }) => {
  const { width, height, ref: targetRef } = useResizeDetector();

  const [graph, setGraph] = useState({
    nodes: [],
    edges: [],
    x: 0,
    y: 0,
    zoom: 1,
    selected: new Set(),
  });

  const [nodes, setNodes] = useState([]); // latest from socket (has risk/community)
  const [edges, setEdges] = useState([]);
  const [newTransaction, setNewTransaction] = useState(null);
  const [lastUpdateTime, setLastUpdateTime] = useState(Date.now());

  useEffect(() => {
    const socket = getSocket();

    const handleInitialData = (data) => {
      if (data && data.nodes && data.edges) {
        setNodes(data.nodes);
        setEdges(data.edges);
      }
    };

    const handleGraphUpdate = (data) => {
      console.log('Received graph update:', data);
      if (data && data.nodes && data.edges) {
        setNodes(data.nodes);
        setEdges(data.edges);
        if (data.newTransaction) {
          setNewTransaction(data.newTransaction);
          setTimeout(() => setNewTransaction(null), 3000);
        }
        setLastUpdateTime(Date.now());
      }
    };
    // Register event listeners
    socket.on('initialData', handleInitialData);
    socket.on('graphUpdate', handleGraphUpdate);

    // Cleanup: remove event listeners on unmount
    return () => {
      socket.off('initialData', handleInitialData);
      socket.off('graphUpdate', handleGraphUpdate);
    };
  }, []);

  // Reference to store node positions across updates
  const prevNodesRef = useRef({});
  const graphDataRef = useRef({ nodes: [], edges: [] });

  // Use merged nodes (layout positions + domain fields) for initial render to preserve risk/community metadata.
  const mergeDomainFields = useCallback((layoutedNodes, sourceNodes) => {
    const byId = new Map(sourceNodes.map((n) => [n.id, n]));
    return layoutedNodes.map((ln) => ({
      ...(byId.get(ln.id) || {}), // riskScore, communityId, label, etc.
      ...ln, // x, y, radius, etc.
    }));
  }, []);

  // Initial graph layout
  useEffect(() => {
    if (width && height && nodes.length > 0 && graph.nodes.length === 0) {
      // First-time layout for the entire graph
      force({ nodes, edges }).then(
        ({ nodes: layoutedNodes, edges: layoutedEdges }) => {
          // Initialize all node positions

          // ★ re-attach risk/community/etc
          const merged = mergeDomainFields(layoutedNodes, nodes);

          merged.forEach((node) => {
            node.radius = 25;
            prevNodesRef.current[node.id] = { x: node.x, y: node.y };
          });

          // Set initial viewport
          const { x, y, zoom } = boundsToViewport(
            getSelectionBounds(merged, 60),
            { width, height }
          );

          // Update graph
          graphDataRef.current = { nodes: merged, edges: layoutedEdges };
          setGraph((prev) => ({
            ...prev,
            nodes: merged,
            edges: layoutedEdges,
            x,
            y,
            zoom,
          }));
        }
      );
    }
  }, [width, height, nodes, edges, graph.nodes.length, mergeDomainFields]);

  // Handle updates to the graph (new transactions)
  useEffect(() => {
    if (
      width &&
      height &&
      nodes.length > 0 &&
      graph.nodes.length > 0 &&
      lastUpdateTime > 0
    ) {
      // Find any new nodes
      const existingNodeIds = new Set(graph.nodes.map((n) => n.id));
      const newNodes = nodes.filter((n) => !existingNodeIds.has(n.id));

      // If we have graph data but received an update
      const updatedNodesWithPositions = nodes.map((node) => {
        // If we already have this node positioned, keep its position
        if (prevNodesRef.current[node.id]) {
          return {
            ...node, // carries risk/community
            x: prevNodesRef.current[node.id].x,
            y: prevNodesRef.current[node.id].y,
            radius: 25,
          };
        }
        // New node - will be positioned by the force layout
        return { ...node, radius: 25 };
      });

      // Only run layout if we have new nodes, otherwise just update the edge data
      if (newNodes.length > 0) {
        force({
          nodes: updatedNodesWithPositions,
          edges,
          nodeForce: (node) => !prevNodesRef.current[node.id], // Only apply forces to new nodes
          alpha: 0.3, // Reduced force strength for updates
          iterations: 10, // Fewer iterations for quicker updates
        }).then(({ nodes: layoutedNodes, edges: layoutedEdges }) => {
          // Save positions of all nodes
          const merged = mergeDomainFields(layoutedNodes, nodes);

          merged.forEach((node) => {
            prevNodesRef.current[node.id] = { x: node.x, y: node.y };
          });

          // Update the graph with new layout
          graphDataRef.current = { nodes: merged, edges: layoutedEdges };
          setGraph((prev) => ({
            ...prev,
            nodes: merged,
            edges: layoutedEdges,
          }));
        });
      } else {
        // Just update edge data without changing node positions
        // Create updated nodes with preserved positions
        const updatedNodes = nodes.map((node) => ({
          ...node,
          x: prevNodesRef.current[node.id]?.x || 0,
          y: prevNodesRef.current[node.id]?.y || 0,
          radius: 25,
        }));

        // Only update the edges, keep nodes in place
        graphDataRef.current = { nodes: updatedNodes, edges };
        setGraph((prev) => ({ ...prev, nodes: updatedNodes, edges })); // ★ was edges-only
      }
    }
  }, [
    lastUpdateTime,
    width,
    height,
    nodes,
    edges,
    graph.nodes.length,
    mergeDomainFields,
  ]);

  const onNodePointerUp = useCallback(
    ({ shiftKey, target: { id } }) => {
      const selectedNode = graph.nodes.find((node) => node.id === id);
      if (selectedNode && onNodeClick) onNodeClick(selectedNode); // Trigger onNodeClick with node data
      setGraph((graph) => ({
        ...graph,
        selected: shiftKey
          ? concatSet(graph.selected, new Set([id]))
          : new Set([id]),
      }));
    },
    [graph.nodes, onNodeClick]
  );

  const onViewportDrag = useCallback(({ viewportX: x, viewportY: y }) => {
    setGraph((g) => ({ ...g, x, y }));
  }, []);

  const onViewportWheel = useCallback(
    ({ viewportX: x, viewportY: y, viewportZoom: zoom }) => {
      setGraph((g) => ({ ...g, x, y, zoom }));
    },
    []
  );

  const onViewportPointerUp = useCallback(() => {
    setGraph((graph) => ({ ...graph, selected: new Set() }));
  }, []);

  const onNodeDrag = useCallback(
    ({ nodeX, nodeY, target: { id, x = 0, y = 0 } }) => {
      const dx = nodeX - x;
      const dy = nodeY - y;

      setGraph((graph) => ({
        ...graph,
        nodes: graph.nodes.map((node) => {
          if (node.id === id || graph.selected.has(node.id)) {
            return { ...node, x: node.x + dx, y: node.y + dy };
          }
          return node;
        }),
      }));
    },
    [graph.selected]
  );

  const onNodePointerEnter = useCallback(({ target: { id } }) => {
    setGraph((graph) => ({ ...graph, hoverNode: id }));
  }, []);

  const onNodePointerLeave = useCallback(() => {
    setGraph((graph) => ({ ...graph, hoverNode: undefined }));
  }, []);

  const onEdgePointerEnter = useCallback(({ target: { id } }) => {
    setGraph((graph) => ({ ...graph, hoverEdge: id }));
  }, []);

  const onEdgePointerLeave = useCallback(() => {
    setGraph((graph) => ({ ...graph, hoverEdge: undefined }));
  }, []);

  const onSelection = useCallback(({ shiftKey, selection }) => {
    setGraph((graph) => ({
      ...graph,
      selected: shiftKey ? concatSet(graph.selected, selection) : selection,
    }));
  }, []);

  // Function to refresh the graph layout
  const refreshGraph = useCallback(() => {
    if (width && height && graph.nodes.length > 0) {
      // Run a full force layout on the current nodes and edges
      force({
        nodes: graph.nodes,
        edges: graph.edges,
        alpha: 0.8, // Higher alpha for more dramatic rearrangement
        iterations: 30, // More iterations for better layout
      }).then(({ nodes: layoutedNodes, edges: layoutedEdges }) => {
        // ★ re-merge current domain fields from graph.nodes
        const merged = mergeDomainFields(layoutedNodes, graph.nodes);

        merged.forEach((node) => {
          prevNodesRef.current[node.id] = { x: node.x, y: node.y };
        });

        graphDataRef.current = { nodes: merged, edges: layoutedEdges };
        setGraph((prev) => ({
          ...prev,
          nodes: merged,
          edges: layoutedEdges,
        }));
      });
      console.log('Graph layout refreshed');
    }
  }, [width, height, graph.nodes, graph.edges, mergeDomainFields]);

  const styledNodes = useMemo(() => {
    return graph.nodes.map((node) =>
      styleNode(
        node,
        node.id === graph.hoverNode,
        graph.selected.has(node.id),
        colorMode
      )
    );
  }, [graph.nodes, graph.selected, graph.hoverNode, colorMode]);

  // Edge animations and risk-weighted edges (your current version)
  const edgeAnimationsRef = useRef(new Map());
  const previousEdgesRef = useRef(new Set());

  const riskById = useMemo(() => {
    const map = new Map();
    graph.nodes.forEach((n) => {
      const risk01 = Math.max(0, Math.min(1, (n.riskScore ?? 0) / 100));
      map.set(n.id, risk01);
    });
    return map;
  }, [graph.nodes]);

  const maxCount = useMemo(() => {
    let m = 1;
    for (const e of graph.edges) {
      const c = e.transactionCount || 0;
      if (c > m) m = c;
    }
    return m;
  }, [graph.edges]);

  const styledEdges = useMemo(() => {
    if (!graph.edges.length) return [];

    const currentEdgeIds = new Set();
    graph.edges.forEach((edge) =>
      currentEdgeIds.add(`${edge.source}-${edge.target}`)
    );
    // Find new edges (those in current set but not in previous set)
    const newEdgeKeys = [...currentEdgeIds].filter(
      (edgeKey) => !previousEdgesRef.current.has(edgeKey)
    );
    // For each new edge, start tracking its animation state
    newEdgeKeys.forEach((edgeKey) => {
      if (previousEdgesRef.current.size > 0) {
        edgeAnimationsRef.current.set(edgeKey, {
          isNew: true,
          startTime: Date.now(),
          duration: 3000, // Animation duration in ms
        });
      }
    });

    if (newTransaction) {
      const txKey = `${newTransaction.from}-${newTransaction.to}`;
      edgeAnimationsRef.current.set(txKey, {
        isNew: true,
        startTime: Date.now(),
        duration: 3000, // Animation duration in ms
        isHighlighted: true,
      });
    }

    // 'community' emphasizes volume; 'risk' emphasizes risk. Current code blends 50/50; adjust W_COUNT/W_RISK or branch on `colorMode` to separate.
    const EDGE_MIN_WIDTH = 1.5;
    const EDGE_MAX_WIDTH = 7;
    const W_COUNT = colorMode === 'risk' ? 0.2 : 1.0;
    const W_RISK = colorMode === 'risk' ? 0.8 : 0.0;

    const clamp01 = (v) => Math.max(0, Math.min(1, v));
    const lerp = (a, b, t) => a + (b - a) * t;

    const result = graph.edges.map((edge) => {
      const key = `${edge.source}-${edge.target}`;

      const countNorm = clamp01((edge.transactionCount || 0) / maxCount);
      const r1 = riskById.get(edge.source) || 0;
      const r2 = riskById.get(edge.target) || 0;
      const riskNorm = Math.max(r1, r2);
      const intensity = clamp01(W_COUNT * countNorm + W_RISK * riskNorm);

      const width = lerp(EDGE_MIN_WIDTH, EDGE_MAX_WIDTH, intensity);
      const hue = 210 - Math.round(210 * intensity); // 210=blue → 0=red
      const color = `hsl(${hue}, 85%, 50%)`;

      const anim = edgeAnimationsRef.current.get(key);
      const now = Date.now();
      if (anim) {
        if (now - anim.startTime > anim.duration) {
          edgeAnimationsRef.current.delete(key);
        } else {
          // Calculate animation progress (0 to 1)
          const progress = (now - anim.startTime) / anim.duration;
          const pulseWidth = width + (1 - progress); // Slightly wider, reduces over time
          const pulseColor = anim.isHighlighted ? '#00BFFF' : '#4287f5';

          // Apply animated styling
          return {
            ...edge,
            style: {
              width: pulseWidth,
              stroke: pulseColor,
              opacity: 1, // Full opacity
              filter: `drop-shadow(0 0 ${8 - 8 * progress}px rgba(0,191,255,${
                0.8 - 0.6 * progress
              }))`,
              transition: 'all 0.2s ease-out', // Smooth transition between frames
            },
          };
        }
      }

      // Regular styling for existing edges
      return {
        ...edge,
        style: {
          width,
          stroke: color,
          transition: 'all 0.3s ease', // Smooth transition for regular updates
        },
      };
    });

    // Update previous edges for next comparison
    previousEdgesRef.current = currentEdgeIds;
    return result;
  }, [graph.edges, graph.nodes, newTransaction, maxCount, riskById, colorMode]);

  // Setup animation refresh timer
  useEffect(() => {
    // Create a timer to refresh animations
    const timer = setInterval(() => {
      // Force re-render to update animations
      if (edgeAnimationsRef.current.size > 0) setLastUpdateTime(Date.now());
    }, 100); // Update animations 10 times per second

    return () => clearInterval(timer);
  }, []);

  return (
    <Selection
      nodes={styledNodes}
      onViewportDrag={onViewportDrag}
      onSelection={onSelection}
    >
      {({
        annotation,
        cursor,
        onViewportDragStart,
        onViewportDrag,
        onViewportDragEnd,
      }) => (
        <div
          ref={targetRef} // Attach ref to the container
          style={{
            position: 'relative',
            overflow: 'hidden',
            height: '500px',
            width: '100%',
          }}
        >
          {newTransaction && (
            <div
              className="transaction-notification"
              style={{
                position: 'absolute',
                right: 10,
                background: 'rgba(0, 0, 0, 0.3)',
                padding: '7px',
                zIndex: 1000,
                borderRadius: '5px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
                animation: 'fadeInOut 3s ease-in-out',
                maxWidth: '300px',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <NotificationsActiveIcon fontSize="small" />
              New Transaction
            </div>
          )}

          <Button
            variant="contained"
            className="no-outline"
            size="small"
            onClick={refreshGraph}
            style={{
              position: 'absolute',
              left: 10,
              zIndex: 1000,
              backgroundColor: 'rgba(43, 234, 251, 0.2)',
              borderRadius: '50%',
              minWidth: '30px',
              width: '30px',
              height: '30px',
              boxShadow: 'none',
            }}
            disableFocusRipple
            disableRipple
            disableTouchRipple
            tabIndex={-1}
          >
            <RefreshIcon fontSize="small" />
          </Button>

          {width === undefined || height === undefined ? (
            <span />
          ) : (
            <Renderer
              width={width}
              height={height}
              nodes={styledNodes}
              edges={styledEdges}
              x={graph.x}
              y={graph.y}
              zoom={graph.zoom}
              cursor={cursor}
              annotations={annotation ? [annotation] : undefined}
              onNodeDrag={onNodeDrag}
              onNodePointerUp={onNodePointerUp}
              onNodePointerEnter={({ target }) =>
                setGraph((g) => ({ ...g, hoverNode: target.id }))
              }
              onNodePointerLeave={() =>
                setGraph((g) => ({ ...g, hoverNode: undefined }))
              }
              onEdgePointerEnter={({ target }) =>
                setGraph((g) => ({ ...g, hoverEdge: target.id }))
              }
              onEdgePointerLeave={() =>
                setGraph((g) => ({ ...g, hoverEdge: undefined }))
              }
              onViewportPointerUp={onViewportPointerUp}
              onViewportDragStart={onViewportDragStart}
              onViewportDrag={onViewportDrag}
              onViewportDragEnd={onViewportDragEnd}
              onViewportWheel={onViewportWheel}
            />
          )}
        </div>
      )}
    </Selection>
  );
};

export default Graph;
