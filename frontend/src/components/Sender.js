import React, { useState, useEffect,useRef } from 'react';
import io from 'socket.io-client';
import '../App.css';
import{QRCodeSVG} from 'qrcode.react';
const socket = io('https://ezshare.onrender.com');

function Sender() {
  const [file, setFile] = useState(null);
  const [shareLink, setShareLink] = useState('');
  const [sendChannel, setSendChannel] = useState(null);
  const [fileSize, setFileSize] = useState(0);
  const [fileSentSize, setFileSentSize] = useState(0);
  const [dragActive,setDragActive,]=useState(false);

  const handleFileChange =(e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setFileSize(selectedFile.size);
      
    }
  };

  const handleDrop=(e)=>{
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const selectedFile=e.dataTransfer.files[0];
    setFile(selectedFile);
    setFileSize(selectedFile.size);
  };

  const handleDragOver=(e)=>{
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }

  const handleDragLeave=(e)=>{
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const copyLink=(e)=>{
    var copyText=document.getElementById("linkinput");
    copyText.select();
    copyText.setSelectionRange(0,99999);
    navigator.clipboard.writeText(copyText.value);
  };
  useEffect(() => {
    if(file){
      handleShare();
    }
  }, [file])
  
  const handleShare = () => {
    if (file) {
      createConnection();
    }
  };

  const fileinputRef =React.createRef();
  const handleClick=()=>{
    fileinputRef.current.click();
  };
  const createConnection = () => {
    const roomId = Math.random().toString(36).slice(2, 8);
    const localConnection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    const sendChannel = localConnection.createDataChannel('sendDataChannel', { ordered: true, maxRetransmits: 0 });
    setSendChannel(sendChannel);

    sendChannel.onopen = () => {
      const metadata = { fileName: file.name, fileType: file.type, fileSize: file.size };
      sendChannel.send(JSON.stringify(metadata));
      sendChunks(sendChannel, file);
    };

    sendChannel.onclose = () => console.log('Data channel closed');

    // Wait for full ICE gathering before registering — ensures candidates are in the offer
    localConnection.onicegatheringstatechange = () => {
      if (localConnection.iceGatheringState === 'complete') {
        socket.emit('register', { roomId, offer: localConnection.localDescription });
        const link = `https://ezshare-alpha.vercel.app/receiver?id=${roomId}`;
        setShareLink(link);
      }
    };

    localConnection.createOffer()
      .then(offer => localConnection.setLocalDescription(offer))
      .catch(console.error);

    socket.on('answer', (data) => {
      localConnection.setRemoteDescription(new RTCSessionDescription(data.answer)).catch(console.error);
    });

    socket.on('candidate', (data) => {
      localConnection.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(console.error);
    });
  };

  const sendChunks = (sendChannel, file) => {
    let offset = 0;

    const readSlice = (offset) => {
      const chunkSize = getDynamicChunkSize(sendChannel.bufferedAmount, file.size - offset);
      const slice = file.slice(offset, offset + chunkSize);
      const reader = new FileReader();

      reader.onload = (event) => {
        const bufferFullCheck = () => {
          if (sendChannel.bufferedAmount <= sendChannel.bufferedAmountLowThreshold) {
            sendChannel.send(event.target.result);
            offset += event.target.result.byteLength;
            setFileSentSize(offset);
            console.log(`Sent ${offset} bytes`);

            if (offset < file.size) {
              setTimeout(() => readSlice(offset), 100); // Delay between chunks
            } else {
              sendChannel.send(new ArrayBuffer(0)); // Indicate end of file
              console.log('File transmission complete');
            }
          } else {
            setTimeout(bufferFullCheck, 100);

          }
        };

        bufferFullCheck();
      };

      reader.readAsArrayBuffer(slice);
    };

    readSlice(offset);
  };

  const getDynamicChunkSize = (bufferedAmount, remainingSize) => {
    const maxChunkSize = 262144; // Maximum chunk size (256KB)
    const minChunkSize = 16384;  // Minimum chunk size (16KB)
    const optimalBufferedAmount = 512000; // Optimal buffered amount (500KB)

    if (bufferedAmount < optimalBufferedAmount / 2) {
      return Math.min(maxChunkSize, remainingSize);
    } else if (bufferedAmount < optimalBufferedAmount) {
      return Math.min(maxChunkSize / 2, remainingSize);
    } else {
      return Math.min(minChunkSize, remainingSize);
    }
  };

  const progressPct = fileSize > 0 ? Math.round((fileSentSize / fileSize) * 100) : 0;
  const fmtSize = (b) => b >= 1e6 ? `${(b/1e6).toFixed(1)} MB` : b >= 1e3 ? `${(b/1e3).toFixed(1)} KB` : `${b} B`;

  return (
    <div className='flexbox'>
      <div className='child1'>
        <div className='dragarea'>
          {shareLink ? (
            <div className='qr'>
              <QRCodeSVG id='qrcode' value={shareLink} />
              <p>Scan to receive file</p>
            </div>
          ) : (
            <div className='draginput' onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onClick={handleClick}>
              <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAACXBIWXMAAAsTAAALEwEAmpwYAAADsElEQVR4nO1ay24URxQtVoDgKyDIbEJIgiByssdBhLnntHqH5JXBfAWseSkoCeYr4AN4rDAoyktskyEhCjuwswiEvjVGje7IiazpIZnuqeruMX2k2ow9c+qcet26dZ3r0KFDhw4doiIjD3qRZSVXlLzrgcdKrivgh41c92Tf/qbAdQ+czdJ0zs0ytNc7rORVDzz1ZF6x/aHAFQU+cLOA3LkdGfmFkg+nED22KflgIHLSOFwb4UWOKvBdaOFjjPjWJ8kR1xbkabpbga8UeB1b/L8mAK+VvJYvLu5qVHyWpnMeeFSX8DHtp4w80Ih4nyTHlHzeoPh/lsS6F/msVvEDkc8V+Ltp8VtMeDkAFmoR74FPFHjRtOiCCTYgsWdClqZzSv7ZtNj/MGEt2p6QLy7u8sCPTYv83wY8spMpuAFKft24uMlnwpdBxfskOaLARsAO/lUwOOC+MoxJRI4GEZ87tyNChNcvmEz2g84C8mGQsDkDTkWYovdHeRRYDc1jx/XUBmiEi40nb47y2GcRjF6dTnySfBhBvHXs+hijV6JwJcmh6gaQV2N0ypPnC1zAhSgGkJcqG+CnS2a8vYksF7hElqNwAb9XT2MxyujnGSkFPgCx+F6l6XvlR18ijYi1JJkv8CXJfDQ+8kxpAzTSpjQcEXLfKN8rkf2x+CyKLW8AcC9Wh/LTp/eM8tln0QwAbpc2wJO/lSSxULY/DGiAW3bUbe7s52zN2xS3UR4nfqsJw5mQJPPD75Dn7Dc2U+W3NoOlfumwGXhcZQaslSFxNaPkEnhWmkAB3UYGZKUJtDMA7/YS8MCv7/omeC/UMTTRMZime1t1DGrMQEhk/yifhautCoQ8cHa7hMIqslTt2YtxOmQXnwKfCFt1GTLY+/w2uA4/cVWhwJUoUxK4UFtCBLhY3YBe73CUTpErBS7yRutSYgarzJjhpGgh+1waA5GTdWRrYxgd5MU4t4cRK0uZtYeRaVPiW+FFPg78NPYi8tPYhqX0XUgoeS30FI3VLJ3vQiNfWNjpyR+aFtfY87jBig/KZopqHvnn4+4Z4Yuj0NISGfJTVwcGwIIVJrVo5F8OyOOu9spQ8lkLxK/XNvLj9oSG64a+j77mJymespqckHHCBOt9w446O5lcW6DAR5GKKUbFrwYPckJiQJ6IUe5iF5vaqkFDwK6hCly29/nKwoEnVuCgvd77bpaRWQAlsqTkNwrc8cAvFlDZ48tmW/PAz5a9Hf6PyFLlNFaHDh06dOjgJsUbR5LPmf/JYJQAAAAASUVORK5CYII=" alt="upload" />
              {dragActive ? <p>Drop the file here...</p> : <p>Drag & Drop files here<br />or<br />Click to select</p>}
              <input type="file" id='fileinput' ref={fileinputRef} onChange={handleFileChange} style={{display:'none'}}/>
            </div>
          )}
        </div>

        {shareLink && (
          <div className='linkinput'>
            <input type="text" value={shareLink} id='linkinput' readOnly />
            <button onClick={copyLink} className='fa fa-copy' title="Copy link"></button>
          </div>
        )}

        {file && fileSize > 0 && fileSentSize > 0 && (
          <div className='progress-wrap'>
            <div className='progress-label'>
              <span>{file.name.length > 20 ? file.name.slice(0,18)+'…' : file.name}</span>
              <span>{fmtSize(fileSentSize)} / {fmtSize(fileSize)} &middot; {progressPct}%</span>
            </div>
            <div className='progress-bar-bg'>
              <div className='progress-bar-fill' style={{width: `${progressPct}%`}}></div>
            </div>
          </div>
        )}

        {file && fileSize > 0 && fileSentSize === 0 && (
          <p className='file-info'>{file.name} &middot; {fmtSize(fileSize)}</p>
        )}
      </div>

      <div className='child2'>
        <h1>Effortless File Sharing,<br />Anytime, Anywhere</h1>
        <div className="features">
          <div className='feat'>
            <div className="icon"><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABoAAAAaCAYAAACpSkzOAAAACXBIWXMAAAsTAAALEwEAmpwYAAABl0lEQVR4nO2WP0sDQRDFD/9gLXaCKBb2IY2FZue4FKmCBG7nOELKtFaJlSik8VvYKAEtBS3EzGjSab6MoikUIrOX1SRcultByIPpjnvcb/e9Oc+ba4aAse0zxp5rAesBMA6BNQVPuPMHRjgEwg9FeJp/qS9PPFS6La3sdePV/UfcCLrxtt8J84r0riJd9DkqK8bQZ13zGesywLoJjEeK8FiRPpMBxs8fo9Eowr68y5go0pfTD2Q5ivELGFvmEF0aQfKlLU+RWhJswf3BmmCz6GSgg0GCDyuCzwyFVYtQRhE2BGMaOmD9XOAo5+wyKMJ3MQ+vwsVMTaau943/EG96rgSszwWxM4P/I5+xIjicGRR70Tqwvh4d7CB7h+HJgqkXwtexHGRrVOAoJ+GakWrptMZkSMOqDbAJM+mihNsG3QZfSkDKQEpBKqiVnupMp22MRsXnrlgJLwy6ZC1gPw2dXQOyEpJO081fjLqW4IvKgk9Wi0UnK0ewyQqaOCfhCIyHwPjm7DKMSxFuAes750ZW8qNhDnEuL13fujn/axix9bUAAAAASUVORK5CYII=" alt="" /></div>
            <div className="text">Direct Peer-to-Peer Connections</div>
          </div>
          <div className='feat'>
            <div className="icon"><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAeCAYAAAA7MK6iAAAACXBIWXMAAAsTAAALEwEAmpwYAAAB10lEQVR4nO2VzytEURTHH2VBin8AKSVslJSNd+6IbEyyuOdMpGZlbclqLOQ/sOMvUFZKjHHOGKZkFgprO6SU/FrR6D7mmR+eHzPPKzXfOqt37vm88+tey6rqvyuUmGwDwR0QfFBC8eGUbi07mDlsS2QCGBeV4KZiulaCR0N7urvY10CVUNY1xu2yoIopXRAoz0xWwDRd4C90Xwimu7LAILRvDoPgKQhuANMyMM0pwXP3BxhXBtK6/h0c9yVjLwHrDiV0+ZE9HQ8mqcX02MBM5sC4VVGPP5PaxVFguikq/U5ZwYBpoaSPTI8qiVOuU9aqAcZ5EHou9cUX4PFmH/N7E7BuVIJrXsPm2C6OWn5qMKnbgensS6hjGPtxUOURxBbqcn0Y9zxhjOu578B4YAv2m6Eay4w1VJyxYnoq3WN6Nv02fbcFw5/vOu1XBC65kZyKYNh1yMZqPaqS+vVEK6Gl3PdQQneC0G3RxEetIGQLhs3K5MFPTJkDgSvB2J+uT05mMs1VCKx7bYmMmMsEBK/y1mfT8lXZWC0IZb7dW8aLwMHgPIs46y+4KsvZ9WjeDs8FUpRQItLjPJFv0NXAOgG5QWPc7svM1AUGVkIpYDocjuumwKBVWRXoFQNCy2O6l+gmAAAAAElFTkSuQmCC" alt="" /></div>
            <div className="text">Rapid Transfer, No Speed Limits</div>
          </div>
          <div className='feat'>
            <div className="icon"><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAeCAYAAAA7MK6iAAAACXBIWXMAAAsTAAALEwEAmpwYAAABz0lEQVR4nO2WzUoDMRDH9wX0IHjwE59DbJNKERUtStmZhT6BH9Vn8aaoF4/e/TiImdUivoEVb+0T2HqzooytWiuZTXcteujAwBIy+8t/MpnE8/r23yx77U8qA0VFeK4Iy4rgqen8jefK4GYqxIlfA85e+GPKwJ4ibGjCV8mVgRdNeKwMTiWCKgMrmrAeBfzhBmsZCnKxoJpwu6WgO+g39cFW10pVAmg73Fm5MoXxWOkV0p4tBaMOYDyUfwQVfQn56VJugD1NwSpXdsQC9qOPjFS9BipzN/5QZxyPaYKqNeWEDc6ktLdFceWXkOd5GYLFJgiqacKF91hCX4wNgw0rWBOcScGc2ta8L3UGKjw2f1sYlAsNTwQwPkjBbfOcxjvSXbaDDdZsgZkQp62Bn1vlz0jV7QmKrccoChqlWhl4FFYM970Ca4K7WMWVXDHai4uvth6C16xBfJ/aGggXThQ0TZiygJ/FBtJUDQdiI4jhyuCu08UvHavuofCYCgsjkeBWyhZcXhwO0Jc0wbIT9MP4Ek/6EODe78WxDAW5OGnn9CqDS14Sm7nyh5WBHa5MF5Wa4Mh5T51fJmGwoQ2cchdqtdc6f3Nz0ATrkUemb94f2BubbpugvgbU1gAAAABJRU5ErkJggg==" alt="" /></div>
            <div className="text">End-to-End Encrypted</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Sender;
