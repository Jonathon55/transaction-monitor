import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useResizeDetector } from "react-resize-detector";
import { getSelectionBounds, boundsToViewport } from "@sayari/trellis";
import * as Force from "@sayari/trellis/layout/force";
import { Renderer } from "@sayari/trellis/bindings/react/renderer";
import { getSocket } from "../../services/socket";
import { concatSet, styleNode } from "./util";
import { Selection } from "@sayari/trellis/bindings/react/selection";
import Button from "@mui/material/Button";
import RefreshIcon from "@mui/icons-material/Refresh";
import NotificationsActiveIcon from "@mui/icons-material/SettingsEthernetSharp";

const force = Force.Layout();

const Graph = ({ onNodeClick }) => {
  const { width, height, ref: targetRef } = useResizeDetector(); // Hook to observe size changes

  const [graph, setGraph] = useState({
    nodes: [],
    edges: [],
    x: 0,
    y: 0,
    zoom: 1,
    selected: new Set(),
    hoverNode: undefined,
    hoverEdge: undefined,
  });

  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [newTransaction, setNewTransaction] = useState(null);
  const [lastUpdateTime, setLastUpdateTime] = useState(Date.now());

  // Connect to WebSocket server
  useEffect(() => {
    // Get the shared socket instance
    const socket = getSocket();

    // Define event handlers
    const handleInitialData = (data) => {
      console.log('Received initial data:', data);
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
          
          // Set a timer to clear the notification after 3 seconds
          setTimeout(() => {
            setNewTransaction(null);
          }, 3000);
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
  
  // Initial graph layout
  useEffect(() => {
    if (width && height && nodes.length > 0 && graph.nodes.length === 0) {
      // First-time layout for the entire graph
      force({ nodes, edges }).then(({ nodes: layoutedNodes, edges: layoutedEdges }) => {
        // Initialize all node positions
        layoutedNodes.forEach(node => {
          node.radius = 25;
          prevNodesRef.current[node.id] = { x: node.x, y: node.y };
        });
        
        // Set initial viewport
        const { x, y, zoom } = boundsToViewport(getSelectionBounds(layoutedNodes, 60), {
          width,
          height,
        });
        
        // Update graph
        graphDataRef.current = { nodes: layoutedNodes, edges: layoutedEdges };
        setGraph(prev => ({ 
          ...prev, 
          nodes: layoutedNodes, 
          edges: layoutedEdges, 
          x, y, zoom 
        }));
      });
    }
  }, [width, height, nodes, edges]);
  
  // Handle updates to the graph (new transactions)
  useEffect(() => {
    if (width && height && nodes.length > 0 && graph.nodes.length > 0 && lastUpdateTime > 0) {
      // Find any new nodes
      const existingNodeIds = new Set(graph.nodes.map(n => n.id));
      const newNodes = nodes.filter(n => !existingNodeIds.has(n.id));
      
      // If we have graph data but received an update
      const updatedNodesWithPositions = nodes.map(node => {
        // If we already have this node positioned, keep its position
        if (prevNodesRef.current[node.id]) {
          return {
            ...node,
            x: prevNodesRef.current[node.id].x,
            y: prevNodesRef.current[node.id].y,
            radius: 25
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
          iterations: 10 // Fewer iterations for quicker updates
        }).then(({ nodes: layoutedNodes, edges: layoutedEdges }) => {
          // Save positions of all nodes
          layoutedNodes.forEach(node => {
            prevNodesRef.current[node.id] = { x: node.x, y: node.y };
          });
          
          // Update the graph with new layout
          graphDataRef.current = { nodes: layoutedNodes, edges: layoutedEdges };
          setGraph(prev => ({ ...prev, nodes: layoutedNodes, edges: layoutedEdges }));
        });
      } else {
        // Just update edge data without changing node positions
        // Create updated nodes with preserved positions
        const updatedNodes = nodes.map(node => ({
          ...node,
          x: prevNodesRef.current[node.id]?.x || 0,
          y: prevNodesRef.current[node.id]?.y || 0,
          radius: 25
        }));
        
        // Only update the edges, keep nodes in place
        graphDataRef.current = { nodes: updatedNodes, edges };
        setGraph(prev => ({ ...prev, edges }));
      }
    }
  }, [lastUpdateTime]);

  const onNodePointerUp = useCallback(
    ({ shiftKey, target: { id } }) => {
      const selectedNode = graph.nodes.find((node) => node.id === id);
      if (selectedNode) onNodeClick(selectedNode); // Trigger onNodeClick with node data
      setGraph((graph) => ({
        ...graph,
        selected: shiftKey ? concatSet(graph.selected, new Set([id])) : new Set([id]),
      }));
    },
    [graph.nodes, onNodeClick]
  );

  const onViewportDrag = useCallback(({ viewportX: x, viewportY: y }) => {
    setGraph((graph) => ({ ...graph, x, y }));
  }, []);
  
  const onViewportWheel = useCallback(({ viewportX: x, viewportY: y, viewportZoom: zoom }) => {
    setGraph((graph) => ({ ...graph, x, y, zoom }));
  }, []);

  const onViewportPointerUp = useCallback(() => {
    setGraph((graph) => ({ ...graph, selected: new Set() }));
  }, []);

  const onNodeDrag = useCallback(({ nodeX, nodeY, target: { id, x = 0, y = 0 } }) => {
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
  }, [graph.selected]);

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
    if (width && height && nodes.length > 0) {
      // Run a full force layout on the current nodes and edges
      force({ 
        nodes: graph.nodes,
        edges: graph.edges,
        alpha: 0.8, // Higher alpha for more dramatic rearrangement
        iterations: 30 // More iterations for better layout
      }).then(({ nodes: layoutedNodes, edges: layoutedEdges }) => {
        // Save new positions
        layoutedNodes.forEach(node => {
          prevNodesRef.current[node.id] = { x: node.x, y: node.y };
        });
        
        // Update graph with new layout
        graphDataRef.current = { nodes: layoutedNodes, edges: layoutedEdges };
        setGraph(prev => ({ ...prev, nodes: layoutedNodes, edges: layoutedEdges }));
        
        // Log refresh action
        console.log('Graph layout refreshed');
      });
    }
  }, [width, height, graph.nodes, graph.edges, nodes.length]);

  const styledNodes = useMemo(() => {
    return graph.nodes.map((node) => styleNode(node, node.id === graph.hoverNode, graph.selected.has(node.id)));


    
  }, [graph.nodes, graph.selected, graph.hoverNode]);

  // Track edge animations state
  const edgeAnimationsRef = useRef(new Map());
  const previousEdgesRef = useRef(new Set());
  
  // Get a more stable edge styling that preserves animations
  const styledEdges = useMemo(() => {
    if (!graph.edges.length) return [];
    
    // Build current edge map
    const currentEdgeIds = new Set();
    graph.edges.forEach(edge => {
      const edgeKey = `${edge.source}-${edge.target}`;
      currentEdgeIds.add(edgeKey);
    });
    
    // Find new edges (those in current set but not in previous set)
    const newEdgeKeys = [...currentEdgeIds].filter(
      edgeKey => !previousEdgesRef.current.has(edgeKey)
    );
    
    // For each new edge, start tracking its animation state
    newEdgeKeys.forEach(edgeKey => {
      if (previousEdgesRef.current.size > 0) { // Don't animate on initial load
        edgeAnimationsRef.current.set(edgeKey, {
          isNew: true,
          startTime: Date.now(),
          duration: 3000 // Animation duration in ms
        });
      }
    });
    
    // Is there a new transaction from the WebSocket?
    if (newTransaction) {
      const transactionEdgeKey = `${newTransaction.from}-${newTransaction.to}`;
      edgeAnimationsRef.current.set(transactionEdgeKey, {
        isNew: true,
        startTime: Date.now(),
        duration: 3000, // Animation duration in ms
        isHighlighted: true
      });
    }
    
    // Style edges based on their animation state
    const result = graph.edges.map(edge => {
      const edgeKey = `${edge.source}-${edge.target}`;
      const transactionCount = edge.transactionCount || 1;
      const baseWidth = Math.min(transactionCount, 5) * 2;
      
      // Check if this edge has an active animation
      const animation = edgeAnimationsRef.current.get(edgeKey);
      const now = Date.now();
      
      if (animation) {
        // If animation has expired, remove it
        if (now - animation.startTime > animation.duration) {
          edgeAnimationsRef.current.delete(edgeKey);
        } else {
          // Calculate animation progress (0 to 1)
          const progress = (now - animation.startTime) / animation.duration;
          const isTransaction = animation.isHighlighted;
          
          // Apply animated styling
          return {
            ...edge,
            style: {
              width: baseWidth + (1 - progress), // Slightly wider, reduces over time
              stroke: isTransaction ? "#00BFFF" : "#4287f5", // Blue for new edges
              opacity: 1, // Full opacity
              filter: `drop-shadow(0 0 ${8 - progress * 8}px rgba(0, 191, 255, ${0.8 - progress * 0.6}))`,
              transition: "all 0.2s ease-out" // Smooth transition between frames
            }
          };
        }
      }
      
      // Regular styling for existing edges
      return {
        ...edge,
        style: {
          width: baseWidth,
          stroke: baseWidth >= 5 ? "red" : "#303336",
          transition: "all 0.3s ease" // Smooth transition for regular updates
        }
      };
    });
    
    // Update previous edges for next comparison
    previousEdgesRef.current = currentEdgeIds;
    
    return result;
  }, [graph.edges, newTransaction]);
  
  // Setup animation refresh timer
  useEffect(() => {
    // Create a timer to refresh animations
    const animationTimer = setInterval(() => {
      if (edgeAnimationsRef.current.size > 0) {
        // Force re-render to update animations
        setLastUpdateTime(Date.now());
      }
    }, 100); // Update animations 10 times per second
    
    return () => clearInterval(animationTimer);
  }, []);

  // Format currency values
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <Selection nodes={styledNodes} onViewportDrag={onViewportDrag} onSelection={onSelection}>
      {({ annotation, cursor, select, onViewportDragStart, onViewportDrag, onViewportDragEnd, toggleSelect }) => (
        <div
          ref={targetRef} // Attach ref to the container
          style={{
            position: "relative",
            overflow: "hidden",
            height: "500px",
            width: '100%'
          }}
        >
          {/* New transaction notification with exclamation icon */}
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
                gap: '8px'
              }}
            >
              <NotificationsActiveIcon 
                fontSize="small" 
                style={{ 
                  //stroke: '#fff',
                  //color: 'transparent',
                }} 
              />
              New Transaction
            </div>
          )}
          
          {/* Refresh button (icon only) with no outline */}
          <Button
            variant="contained"
            className="no-outline"
            color="#fff"
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
              boxShadow: 'none'
            }}
            disableFocusRipple
            disableRipple
            disableTouchRipple
            focusRipple={false}
            tabIndex={-1}
          >
            <RefreshIcon fontSize="small" />
          </Button>


          {/* Graph visualization */}
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
              onNodePointerEnter={onNodePointerEnter}
              onNodePointerLeave={onNodePointerLeave}
              onEdgePointerEnter={onEdgePointerEnter}
              onEdgePointerLeave={onEdgePointerLeave}
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
