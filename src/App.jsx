import { useEffect, useRef, useState } from "react";
import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import "./App.css";

function App() {
  const [socketMessages, setSocketMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [searchStatus, setSearchStatus] = useState(null);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);

  // Initialize WebSocket connection
  const isInitialized = useRef(false);
  const reconnectTimeoutRef = useRef(null);

  const connectWebSocket = () => {
    const ws = new WebSocket("ws://127.0.0.1:8001/ws/project/21/");

    ws.onopen = () => {
      console.log("Connected to WebSocket");
      setSocket(ws);
      setConnected(true);
      setReconnectAttempt(0); // Reset reconnection attempts on successful connection
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log("Received message:", data);

      // Add message to chat history based on type
      if (data.type === "text" && data.data && data.data.message) {
        setSocketMessages((prev) => [
          ...prev,
          {
            type: "received",
            agent: data.source,
            message: data.data.message,
            timestamp: new Date(),
          },
        ]);
      } else if (data.type === "message_status" && data.success) {
        console.log("Message delivered:", data.message);
      } else if (data.type === "search") {
        setSearchStatus(data.data);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      setConnected(false);
    };

    ws.onclose = (event) => {
      console.log("WebSocket connection closed", event);
      setConnected(false);

      // Only attempt to reconnect if it wasn't a normal closure
      if (event.code !== 1000) {
        handleReconnect();
      }
    };

    return ws;
  };

  const handleReconnect = () => {
    // Clear any existing timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    // Exponential backoff: 1s, 2s, 4s, 8s, etc. with a maximum of 30s
    const nextAttempt = Math.min(2 ** reconnectAttempt * 1000, 30000);

    console.log(`Attempting to reconnect in ${nextAttempt / 1000} seconds...`);

    reconnectTimeoutRef.current = setTimeout(() => {
      console.log(`Reconnecting... (Attempt ${reconnectAttempt + 1})`);
      setReconnectAttempt((prev) => prev + 1);

      // Close existing socket if any
      if (socket) {
        socket.close();
      }

      // Create new connection
      connectWebSocket();
    }, nextAttempt);
  };

  useEffect(() => {
    if (!isInitialized.current) {
      const ws = connectWebSocket();
      isInitialized.current = true;

      return () => {
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        if (ws) {
          ws.close();
        }
      };
    }
  }, []);

  const sendMessage = (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    if (socket && socket.readyState === WebSocket.OPEN) {
      const messageToSend = {
        agent_name: "researcher",
        message: message,
      };
      console.log("Sending message:", messageToSend);
      socket.send(JSON.stringify(messageToSend));

      // Add sent message to chat history
      setSocketMessages((prev) => [
        ...prev,
        {
          type: "sent",
          agent: "user",
          message: message,
          timestamp: new Date(),
        },
      ]);

      setMessage("");
    } else {
      console.error("WebSocket not connected");
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Chat Header */}
      <div className="bg-white shadow-sm p-4 flex justify-between items-center">
        <h1 className="text-xl font-semibold text-gray-800">WebSocket Chat</h1>
        <div
          className={`px-3 py-1 rounded-full text-sm font-medium ${
            connected
              ? "bg-green-100 text-green-800"
              : "bg-red-100 text-red-800"
          }`}
        >
          {connected ? "Connected" : "Disconnected"}
        </div>
      </div>

      {/* Messages Section */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {socketMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500 text-center">
              No messages yet. Start a conversation!
            </p>
          </div>
        ) : (
          socketMessages.map((msg, index) => (
            <div
              key={index}
              className={`flex ${
                msg.type === "sent" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-xs md:max-w-md rounded-lg px-4 py-2 ${
                  msg.type === "sent"
                    ? "bg-blue-500 text-white rounded-br-none"
                    : "bg-white shadow rounded-bl-none"
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span
                    className={`font-medium text-xs ${
                      msg.type === "sent" ? "text-blue-100" : "text-gray-600"
                    }`}
                  >
                    {msg.agent}
                  </span>
                  <span
                    className={`text-xs ${
                      msg.type === "sent" ? "text-blue-100" : "text-gray-400"
                    }`}
                  >
                    {msg.timestamp.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="text-sm break-words">{msg.message}</p>
              </div>
            </div>
          ))
        )}

        {searchStatus && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 my-2">
            <div className="text-sm text-yellow-800">
              <p className="font-medium">
                Search ticket: {searchStatus.search_ticket_id}
              </p>
              <p className="mt-1">
                Status:{" "}
                {searchStatus.status === 0 ? (
                  <span className="text-amber-600">Pending</span>
                ) : (
                  <span className="text-green-600">Complete</span>
                )}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Message Input */}
      <div className="bg-white border-t p-4">
        <form className="flex space-x-2" onSubmit={sendMessage}>
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message..."
            disabled={!connected}
            className="flex-1 border rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
          />
          <button
            type="submit"
            disabled={!connected || !message.trim()}
            className="bg-blue-500 text-white rounded-full px-5 py-2 font-medium hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-300"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

export default App;
