import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';
import '../App.css';

function Receiver() {
  const [fileInfo, setFileInfo] = useState({});
  const [downloadUrl, setDownloadUrl] = useState('');
  const [receivedSize, setReceivedSize] = useState(0);
  const [error, setError] = useState('');

  const params = new URLSearchParams(window.location.search);
  const roomId = params.get('id');

  const ICE_SERVERS = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      {
        urls: 'turn:relay1.expressturn.com:3478',
        username: 'efNOBGLHAGCTEFMV4B',
        credential: 'aDAWRmsoIkGzOPsX'
      }
    ]
  };

  useEffect(() => {
    if (!roomId) { setError('Invalid link — no room ID found.'); return; }

    const socket = io('https://ezshare.onrender.com', { transports: ['websocket'] });
    const remoteConnection = new RTCPeerConnection(ICE_SERVERS);

    remoteConnection.onconnectionstatechange = () => {
      console.log('[Receiver] Connection state:', remoteConnection.connectionState);
    };
    remoteConnection.oniceconnectionstatechange = () => {
      console.log('[Receiver] ICE state:', remoteConnection.iceConnectionState);
    };
    remoteConnection.onicegatheringstatechange = () => {
      console.log('[Receiver] ICE gathering:', remoteConnection.iceGatheringState);
    };

    remoteConnection.ondatachannel = (event) => {
      const receiveChannel = event.channel;
      const chunks = [];
      let metadata = null;
      let received = 0;

      receiveChannel.onmessage = (event) => {
        if (typeof event.data === 'string') {
          metadata = JSON.parse(event.data);
          setFileInfo(metadata);
        } else if (event.data.byteLength === 0) {
          const blob = new Blob(chunks, { type: metadata.fileType });
          setDownloadUrl(URL.createObjectURL(blob));
        } else {
          chunks.push(event.data);
          received += event.data.byteLength;
          setReceivedSize(received);
        }
      };
    };

    remoteConnection.onicecandidate = (event) => {
      if (event.candidate) socket.emit('candidate', { roomId, candidate: event.candidate });
    };

    // Server sends back the offer once we join
    socket.on('offer', ({ offer }) => {
      remoteConnection.setRemoteDescription(new RTCSessionDescription(offer))
        .then(() => {
          pendingCandidates.forEach(c => remoteConnection.addIceCandidate(new RTCIceCandidate(c)).catch(console.error));
          pendingCandidates = [];
          return remoteConnection.createAnswer();
        })
        .then(answer => remoteConnection.setLocalDescription(answer))
        .then(() => {
          remoteConnection.onicegatheringstatechange = () => {
            if (remoteConnection.iceGatheringState === 'complete') {
              socket.emit('answer', { roomId, answer: remoteConnection.localDescription });
            }
          };
          if (remoteConnection.iceGatheringState === 'complete') {
            socket.emit('answer', { roomId, answer: remoteConnection.localDescription });
          }
        })
        .catch(console.error);
    });

    socket.on('candidate', (data) => {
      if (remoteConnection.remoteDescription) {
        remoteConnection.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(console.error);
      } else {
        pendingCandidates.push(data.candidate);
      }
    });

    let pendingCandidates = [];

    socket.on('error', (data) => setError(data.message));

    // Emit join only after socket is confirmed connected
    const doJoin = () => socket.emit('join', { roomId });
    if (socket.connected) {
      doJoin();
    } else {
      socket.on('connect', doJoin);
    }

    return () => { socket.disconnect(); };
  }, [roomId]);

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = fileInfo.fileName;
    a.click();
  };

  const fmtSize = (b) => b >= 1e6 ? `${(b / 1e6).toFixed(1)} MB` : b >= 1e3 ? `${(b / 1e3).toFixed(1)} KB` : `${b} B`;
  const progressPct = fileInfo.fileSize > 0 ? Math.min(100, Math.round((receivedSize / fileInfo.fileSize) * 100)) : 0;
  const isReceiving = fileInfo.fileName && !downloadUrl;
  const isDone = !!downloadUrl;

  return (
    <div className="flexbox">

      {/* Right — card */}
      <div className="child1">
        <div className="receiver-card">

          {error && (
            <>
              <div className="receiver-icon receiver-icon--done" style={{background:'rgba(239,68,68,0.15)', color:'#ef4444'}}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
                </svg>
              </div>
              <h2 className="receiver-title">Something went wrong</h2>
              <p className="receiver-sub">{error}</p>
            </>
          )}

          {!error && !fileInfo.fileName && !downloadUrl && (
            <>
              <div className="receiver-icon receiver-icon--waiting">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                </svg>
              </div>
              <h2 className="receiver-title">Connecting to sender...</h2>
              <p className="receiver-sub">Keep this page open while the connection is established.</p>
            </>
          )}

          {isReceiving && (
            <>
              <div className="receiver-icon receiver-icon--receiving">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 3v13M7 11l5 5 5-5"/><path d="M5 20h14"/>
                </svg>
              </div>
              <h2 className="receiver-title">Receiving file</h2>
              <p className="receiver-filename">{fileInfo.fileName}</p>
              <p className="receiver-sub">{fmtSize(receivedSize)} of {fmtSize(fileInfo.fileSize)}</p>
              <div className="progress-bar-bg" style={{width:'100%', marginTop:'12px'}}>
                <div className="progress-bar-fill" style={{width:`${progressPct}%`}}></div>
              </div>
              <p className="receiver-pct">{progressPct}%</p>
            </>
          )}

          {isDone && (
            <>
              <div className="receiver-icon receiver-icon--done">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
              </div>
              <h2 className="receiver-title">Ready to download</h2>
              <p className="receiver-filename">{fileInfo.fileName}</p>
              <p className="receiver-sub">{fmtSize(fileInfo.fileSize)}</p>
              <button className="receiver-btn" onClick={handleDownload}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 3v13M7 11l5 5 5-5"/><path d="M5 20h14"/>
                </svg>
                Download {fileInfo.fileName}
              </button>
            </>
          )}

        </div>
      </div>

      {/* Left — hero */}
      <div className="child2">
        <h1>Someone shared a file with you</h1>
        <div className="features">
          <div className="feat">
            <div className="icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <div className="text">Your file transfers directly — no server storage</div>
          </div>
          <div className="feat">
            <div className="icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
              </svg>
            </div>
            <div className="text">Files are delivered in real time, peer-to-peer</div>
          </div>
          <div className="feat">
            <div className="icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
            </div>
            <div className="text">No size limits — transfer any file instantly</div>
          </div>
        </div>
      </div>

    </div>
  );
}

export default Receiver;
