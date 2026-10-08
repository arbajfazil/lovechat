import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";

// ======================================================
// PASTE YOUR RENDER SERVER URL HERE AFTER DEPLOYMENT
// For local testing keep:
// http://localhost:5000
// ======================================================

const SERVER_URL = "http://localhost:5000";

const socket = io(SERVER_URL, {
  autoConnect: true,
});

const emojis = [
  "❤️",
  "😍",
  "🥰",
  "😘",
  "😂",
  "😊",
  "😢",
  "😡",
  "😎",
  "🤗",
  "🔥",
  "✨",
];

function getParticipantId() {
  let id = localStorage.getItem(
    "love_chat_participant_id"
  );

  if (!id) {
    id =
      "person_" +
      Math.random()
        .toString(36)
        .substring(2) +
      Date.now();

    localStorage.setItem(
      "love_chat_participant_id",
      id
    );
  }

  return id;
}

function App() {
  const participantId = useMemo(
    () => getParticipantId(),
    []
  );

  const savedRoomCode = localStorage.getItem(
    "love_chat_room_code"
  );

  const savedName = localStorage.getItem(
    "love_chat_name"
  );

  const [screen, setScreen] = useState(
    savedRoomCode ? "room" : "home"
  );

  const [name, setName] = useState(
    savedName || ""
  );

  const [roomCode, setRoomCode] = useState(
    savedRoomCode || ""
  );

  const [myRoomCode, setMyRoomCode] =
    useState(savedRoomCode || "");

  const [messages, setMessages] =
    useState([]);

  const [message, setMessage] =
    useState("");

  const [hearts, setHearts] =
    useState(10);

  const [participants, setParticipants] =
    useState([]);

  const [error, setError] =
    useState("");

  const [status, setStatus] =
    useState("");

  const [heartAnimation, setHeartAnimation] =
    useState(null);

  const messagesEndRef =
    useRef(null);

  const inputRef =
    useRef(null);

  // ====================================================
  // FIND OTHER PERSON
  // ====================================================

  const otherPerson = participants.find(
    (person) =>
      person.participantId !==
      participantId
  );

  const otherName =
    otherPerson?.name ||
    "Waiting for person...";

  // ====================================================
  // SOCKET EVENTS
  // ====================================================

  useEffect(() => {
    function handleNewMessage(newMessage) {
      setMessages((oldMessages) => [
        ...oldMessages,
        newMessage,
      ]);
    }

    function handleHeartsUpdate(data) {
      setHearts(data.hearts);

      setHeartAnimation({
        change: data.change,
        emotion: data.emotion,
      });

      setTimeout(() => {
        setHeartAnimation(null);
      }, 2500);
    }

    function handleRoomUsersUpdate(data) {
      setParticipants(
        data.participants || []
      );
    }

    socket.on(
      "new-message",
      handleNewMessage
    );

    socket.on(
      "hearts-update",
      handleHeartsUpdate
    );

    socket.on(
      "room-users-update",
      handleRoomUsersUpdate
    );

    return () => {
      socket.off(
        "new-message",
        handleNewMessage
      );

      socket.off(
        "hearts-update",
        handleHeartsUpdate
      );

      socket.off(
        "room-users-update",
        handleRoomUsersUpdate
      );
    };
  }, []);

  // ====================================================
  // AUTO REJOIN SAVED ROOM AFTER REFRESH
  // ====================================================

  useEffect(() => {
    const savedCode =
      localStorage.getItem(
        "love_chat_room_code"
      );

    const savedUserName =
      localStorage.getItem(
        "love_chat_name"
      );

    if (!savedCode) {
      return;
    }

    function rejoinRoom() {
      socket.emit(
        "join-room",
        {
          code: savedCode,
          participantId,
          name:
            savedUserName ||
            "Anonymous",
        },
        (response) => {
          if (!response?.success) {
            localStorage.removeItem(
              "love_chat_room_code"
            );

            setRoomCode("");
            setMyRoomCode("");
            setScreen("home");

            setError(
              response?.message ||
                "Could not reconnect to room."
            );

            return;
          }

          setRoomCode(response.code);

          setMyRoomCode(response.code);

          setMessages(
            response.messages || []
          );

          setHearts(
            response.hearts || 10
          );

          setParticipants(
            response.participants || []
          );

          setScreen("room");
        }
      );
    }

    if (socket.connected) {
      rejoinRoom();
    } else {
      socket.once(
        "connect",
        rejoinRoom
      );
    }

    return () => {
      socket.off(
        "connect",
        rejoinRoom
      );
    };
  }, [participantId]);

  // ====================================================
  // AUTO SCROLL
  // ====================================================

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);

  // ====================================================
  // CREATE ROOM
  // ====================================================

  function createRoom() {
    setError("");

    const cleanName =
      name.trim() || "Anonymous";

    localStorage.setItem(
      "love_chat_name",
      cleanName
    );

    socket.emit(
      "create-room",
      {
        participantId,
        name: cleanName,
      },
      (response) => {
        if (!response?.success) {
          setError(
            response?.message ||
              "Could not create room."
          );

          return;
        }

        localStorage.setItem(
          "love_chat_room_code",
          response.code
        );

        setMyRoomCode(response.code);

        setRoomCode(response.code);

        setMessages(
          response.messages || []
        );

        setHearts(
          response.hearts || 10
        );

        setParticipants(
          response.participants || []
        );

        setScreen("room");
      }
    );
  }

  // ====================================================
  // JOIN ROOM
  // ====================================================

  function joinRoom() {
    setError("");

    const cleanCode =
      roomCode.trim();

    if (!/^\d{6}$/.test(cleanCode)) {
      setError(
        "Enter a valid 6 digit room code."
      );

      return;
    }

    const cleanName =
      name.trim() || "Anonymous";

    localStorage.setItem(
      "love_chat_name",
      cleanName
    );

    socket.emit(
      "join-room",
      {
        code: cleanCode,
        participantId,
        name: cleanName,
      },
      (response) => {
        if (!response?.success) {
          setError(
            response?.message ||
              "Could not join room."
          );

          return;
        }

        localStorage.setItem(
          "love_chat_room_code",
          response.code
        );

        setMyRoomCode(response.code);

        setRoomCode(response.code);

        setMessages(
          response.messages || []
        );

        setHearts(
          response.hearts || 10
        );

        setParticipants(
          response.participants || []
        );

        setScreen("room");
      }
    );
  }

  // ====================================================
  // SEND MESSAGE
  // ====================================================

  function sendMessage() {
    const cleanMessage =
      message.trim();

    if (!cleanMessage) return;

    socket.emit("send-message", {
      code: myRoomCode,

      participantId,

      text: cleanMessage,
    });

    setMessage("");

    inputRef.current?.focus();
  }

  // ====================================================
  // ENTER KEY
  // ====================================================

  function handleKeyDown(event) {
    if (event.key === "Enter") {
      event.preventDefault();

      sendMessage();
    }
  }

  // ====================================================
  // ADD EMOJI
  // ====================================================

  function addEmoji(emoji) {
    setMessage(
      (oldMessage) =>
        oldMessage + emoji
    );

    inputRef.current?.focus();
  }

  // ====================================================
  // CHANGE NAME
  // ====================================================

  function changeName() {
    const newName =
      prompt(
        "Enter the name you want the other person to see:",
        name
      );

    if (!newName?.trim()) {
      return;
    }

    const cleanName =
      newName.trim();

    localStorage.setItem(
      "love_chat_name",
      cleanName
    );

    setName(cleanName);

    socket.emit("change-name", {
      code: myRoomCode,

      participantId,

      name: cleanName,
    });
  }

  // ====================================================
  // COPY CODE
  // ====================================================

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(
        myRoomCode
      );

      setStatus("Code copied!");

      setTimeout(() => {
        setStatus("");
      }, 1500);
    } catch {
      setStatus(
        "Copy failed. Select the code manually."
      );
    }
  }

  // ====================================================
  // EXIT ROOM
  // ====================================================

  function exitRoom() {
    localStorage.removeItem(
      "love_chat_room_code"
    );

    setRoomCode("");

    setMyRoomCode("");

    setMessages([]);

    setParticipants([]);

    setHearts(10);

    setMessage("");

    setError("");

    setStatus("");

    setScreen("home");

    socket.disconnect();

    setTimeout(() => {
      socket.connect();
    }, 100);
  }

  // ====================================================
  // HOME SCREEN
  // ====================================================

  if (screen === "home") {
    return (
      <div className="app">

        <div className="home-background">

          <div className="floating-heart h1">
            ❤️
          </div>

          <div className="floating-heart h2">
            ❤️
          </div>

          <div className="floating-heart h3">
            ❤️
          </div>

          <div className="floating-heart h4">
            ❤️
          </div>

          <div className="floating-heart h5">
            ❤️
          </div>

        </div>

        <main className="home-card">

          <div className="logo">
            ❤️
          </div>

          <h1>Love Chat</h1>

          <p className="subtitle">
            A private chat for two people
          </p>

          <div className="name-box">

            <label>
              Your name for the other person
            </label>

            <input
              value={name}
              onChange={(e) =>
                setName(e.target.value)
              }
              placeholder="Enter a name..."
              maxLength={25}
            />

          </div>

          <button
            className="primary-button"
            onClick={createRoom}
          >
            Create New Room
          </button>

          <div className="or">

            <span></span>

            OR

            <span></span>

          </div>

          <input
            className="code-input"
            value={roomCode}
            onChange={(e) =>
              setRoomCode(
                e.target.value
                  .replace(/\D/g, "")
                  .slice(0, 6)
              )
            }
            placeholder="Enter 6 digit code"
            maxLength={6}
          />

          <button
            className="join-button"
            onClick={joinRoom}
          >
            Join Room
          </button>

          {error && (
            <div className="error">
              {error}
            </div>
          )}

          <div className="privacy-note">
            🔒 Messages are saved permanently.
            <br />
            No delete option.
          </div>

        </main>

      </div>
    );
  }

  // ====================================================
  // CHAT ROOM
  // ====================================================

  return (
    <div className="chat-app">

      {/* BACKGROUND HEARTS */}

      <div className="heart-background">

        {Array.from({
          length: Math.min(
            80,
            Math.max(20, hearts * 2)
          ),
        }).map((_, index) => (

          <span
            key={index}
            className="background-heart"
          >
            ♥
          </span>

        ))}

      </div>

      {/* HEADER */}

      <header className="chat-header">

        <div className="header-left">

          <div className="chat-logo">
            ❤️
          </div>

          <div>

            <h2>Love Chat</h2>

            <div className="person-status">

              <span className="online-dot"></span>

              {otherName}

            </div>

          </div>

        </div>

        <div className="header-right">

          <div className="heart-counter">

            <span>❤️</span>

            <strong>{hearts}</strong>

          </div>

          <button
            className="name-button"
            onClick={changeName}
          >
            Name
          </button>

          <button
            className="exit-button"
            onClick={exitRoom}
          >
            Exit
          </button>

        </div>

      </header>

      {/* ROOM BAR */}

      <div className="room-bar">

        <div>

          <span className="room-label">
            ROOM
          </span>

          <strong className="room-code">
            {myRoomCode}
          </strong>

        </div>

        <button
          onClick={copyCode}
          className="copy-button"
        >
          Copy Code
        </button>

        {status && (
          <span className="copy-status">
            {status}
          </span>
        )}

      </div>

      {/* HEART UPDATE */}

      {heartAnimation && (
        <div
          className={`heart-update ${
            heartAnimation.change > 0
              ? "positive"
              : "negative"
          }`}
        >

          {heartAnimation.change > 0
            ? `❤️ +${heartAnimation.change} hearts`
            : `💔 ${heartAnimation.change} hearts`}

        </div>
      )}

      {/* MESSAGES */}

      <main className="messages-area">

        <div className="chat-start">

          <div className="start-heart">
            ❤️
          </div>

          <h3>
            Your private space
          </h3>

          <p>
            Messages in this room cannot
            be deleted.
          </p>

        </div>

        {messages.map((msg) => {

          const isMine =
            msg.participantId ===
            participantId;

          const senderName = isMine
            ? "You"
            : otherName;

          return (
            <div
              className={`message-row ${
                isMine
                  ? "mine"
                  : "theirs"
              }`}
              key={msg.id}
            >

              <div
                className={`message-bubble ${
                  isMine
                    ? "mine-bubble"
                    : "their-bubble"
                }`}
              >

                <div className="sender-name">
                  {senderName}
                </div>

                <div className="message-text">
                  {msg.text}
                </div>

                <div className="message-time">

                  {new Date(
                    msg.createdAt
                  ).toLocaleTimeString(
                    [],
                    {
                      hour: "2-digit",
                      minute: "2-digit",
                    }
                  )}

                </div>

              </div>

            </div>
          );
        })}

        <div
          ref={messagesEndRef}
        />

      </main>

      {/* EMOJI BAR */}

      <div className="emoji-bar">

        {emojis.map((emoji) => (

          <button
            key={emoji}
            onClick={() =>
              addEmoji(emoji)
            }
          >
            {emoji}
          </button>

        ))}

      </div>

      {/* MESSAGE INPUT */}

      <div className="message-input-area">

        <input
          ref={inputRef}
          value={message}
          onChange={(e) =>
            setMessage(e.target.value)
          }
          onKeyDown={handleKeyDown}
          placeholder={`Message ${otherName}...`}
          maxLength={1000}
        />

        <button
          className="send-button"
          onClick={sendMessage}
        >
          ➤
        </button>

      </div>

      <div className="bottom-note">
        🔒 This conversation is permanent
      </div>

    </div>
  );
}

export default App;