import React, { useState, useEffect,useRef } from 'react';
import io from 'socket.io-client';
import '../App.css';
import{QRCodeSVG} from 'qrcode.react';
const socket = io('http://localhost:5000');

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
    const localConnection = new RTCPeerConnection();

    localConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('candidate', { candidate: event.candidate });
      }
    };

    const dataChannelOptions = {
      ordered: true, // Guarantee order
      maxRetransmits: 0, // Don't retransmit
    };

    const sendChannel = localConnection.createDataChannel('sendDataChannel', dataChannelOptions);
    setSendChannel(sendChannel);

    sendChannel.onopen = () => {
      console.log('Data channel is open');

      const metadata = {
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size
      };
      sendChannel.send(JSON.stringify(metadata));
      console.log('File metadata sent:', metadata);

      sendChunks(sendChannel, file);
    };

    sendChannel.onclose = () => {
      console.log('Data channel is closed');
    };

    localConnection.createOffer().then((offer) => {
      return localConnection.setLocalDescription(offer);
    }).then(() => {
      const link = `http://localhost:3000/receiver?id=${encodeURIComponent(localConnection.localDescription.sdp)}`;
      setShareLink(link);
      console.log(`Share link: ${link}`);
    }).catch(console.error);

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
            setTimeout(bufferFullCheck, 100); // Retry after delay
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

  return (
    <div className='flexbox'>
      <div className='child1'>
        <div className='dragarea'>
        {shareLink?(<div className='qr'>
          <QRCodeSVG id='qrcode' value={shareLink} />
        </div>):(<div className='draginput' onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onClick={handleClick} >
        <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAACXBIWXMAAAsTAAALEwEAmpwYAAADsElEQVR4nO1ay24URxQtVoDgKyDIbEJIgiByssdBhLnntHqH5JXBfAWseSkoCeYr4AN4rDAoyktskyEhCjuwswiEvjVGje7IiazpIZnuqeruMX2k2ow9c+qcet26dZ3r0KFDhw4doiIjD3qRZSVXlLzrgcdKrivgh41c92Tf/qbAdQ+czdJ0zs0ytNc7rORVDzz1ZF6x/aHAFQU+cLOA3LkdGfmFkg+nED22KflgIHLSOFwb4UWOKvBdaOFjjPjWJ8kR1xbkabpbga8UeB1b/L8mAK+VvJYvLu5qVHyWpnMeeFSX8DHtp4w80Ih4nyTHlHzeoPh/lsS6F/msVvEDkc8V+Ltp8VtMeDkAFmoR74FPFHjRtOiCCTYgsWdClqZzSv7ZtNj/MGEt2p6QLy7u8sCPTYv83wY8spMpuAFKft24uMlnwpdBxfskOaLARsAO/lUwOOC+MoxJRI4GEZ87tyNChNcvmEz2g84C8mGQsDkDTkWYovdHeRRYDc1jx/XUBmiEi40nb47y2GcRjF6dTnySfBhBvHXs+hijV6JwJcmh6gaQV2N0ypPnC1zAhSgGkJcqG+CnS2a8vYksF7hElqNwAb9XT2MxyujnGSkFPgCx+F6l6XvlR18ijYi1JJkv8CXJfDQ+8kxpAzTSpjQcEXLfKN8rkf2x+CyKLW8AcC9Wh/LTp/eM8tln0QwAbpc2wJO/lSSxULY/DGiAW3bUbe7s52zN2xS3UR4nfqsJw5mQJPPD75Dn7Dc2U+W3NoOlfumwGXhcZQaslSFxNaPkEnhWmkAB3UYGZKUJtDMA7/YS8MCv7/omeC/UMTTRMZime1t1DGrMQEhk/yifhautCoQ8cHa7hMIqslTt2YtxOmQXnwKfCFt1GTLY+/w2uA4/cVWhwJUoUxK4UFtCBLhY3YBe73CUTpErBS7yRutSYgarzJjhpGgh+1waA5GTdWRrYxgd5MU4t4cRK0uZtYeRaVPiW+FFPg78NPYi8tPYhqX0XUgoeS30FI3VLJ3vQiNfWNjpyR+aFtfY87jBig/KZopqHvnn4+4Z4Yuj0NISGfJTVwcGwIIVJrVo5F8OyOOu9spQ8lkLxK/XNvLj9oSG64a+j77mJymespqckHHCBOt9w446O5lcW6DAR5GKKUbFrwYPckJiQJ6IUe5iF5vaqkFDwK6hCly29/nKwoEnVuCgvd77bpaRWQAlsqTkNwrc8cAvFlDZ48tmW/PAz5a9Hf6PyFLlNFaHDh06dOjgJsUbR5LPmf/JYJQAAAAASUVORK5CYII=" />
          {dragActive?(<p>Drop the file here...</p>):(<p>Drag and Drop files here <br />Or <br />Click to select files</p>)}
          <input type="file" id='fileinput' ref={fileinputRef} onChange={handleFileChange} style={{display:'none'}}/>
        </div>)}
        
       
      </div>
      {shareLink && (<div className='linkinput'>
            <input type="text" value={shareLink} id='linkinput'/>
            <button onClick={copyLink} className='fa fa-copy'></button>
          </div>)}
        
        {file && (
        <p>File size: {fileSize} bytes</p>
       )}
        {file && fileSentSize > 0 && (
          <p>Sent: {fileSentSize} bytes</p>
        )}
      </div>

      <div className='child2'>
        <h1>Effortless File Sharing, Anytime, Anywhere</h1>
        <div className="features">
                <div className='feat'>
                <div className="icon"><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABoAAAAaCAYAAACpSkzOAAAACXBIWXMAAAsTAAALEwEAmpwYAAABl0lEQVR4nO2WP0sDQRDFD/9gLXaCKBb2IY2FZue4FKmCBG7nOELKtFaJlSik8VvYKAEtBS3EzGjSab6MoikUIrOX1SRcultByIPpjnvcb/e9Oc+ba4aAse0zxp5rAesBMA6BNQVPuPMHRjgEwg9FeJp/qS9PPFS6La3sdePV/UfcCLrxtt8J84r0riJd9DkqK8bQZ13zGesywLoJjEeK8FiRPpMBxs8fo9Eowr68y5go0pfTD2Q5ivELGFvmEF0aQfKlLU+RWhJswf3BmmCz6GSgg0GCDyuCzwyFVYtQRhE2BGMaOmD9XOAo5+wyKMJ3MQ+vwsVMTaau943/EG96rgSszwWxM4P/I5+xIjicGRR70Tqwvh4d7CB7h+HJgqkXwtexHGRrVOAoJ+GakWrptMZkSMOqDbAJM+mihNsG3QZfSkDKQEpBKqiVnupMp22MRsXnrlgJLwy6ZC1gPw2dXQOyEpJO081fjLqW4IvKgk9Wi0UnK0ewyQqaOCfhCIyHwPjm7DKMSxFuAes750ZW8qNhDnEuL13fujn/axix9bUAAAAASUVORK5CYII="/></div>
                <div className="text">Direct Peer Connections</div>
                <div className="icon"><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAeCAYAAAA7MK6iAAAACXBIWXMAAAsTAAALEwEAmpwYAAAB10lEQVR4nO2VzytEURTHH2VBin8AKSVslJSNd+6IbEyyuOdMpGZlbclqLOQ/sOMvUFZKjHHOGKZkFgprO6SU/FrR6D7mmR+eHzPPKzXfOqt37vm88+tey6rqvyuUmGwDwR0QfFBC8eGUbi07mDlsS2QCGBeV4KZiulaCR0N7urvY10CVUNY1xu2yoIopXRAoz0xWwDRd4C90Xwimu7LAILRvDoPgKQhuANMyMM0pwXP3BxhXBtK6/h0c9yVjLwHrDiV0+ZE9HQ8mqcX02MBM5sC4VVGPP5PaxVFguikq/U5ZwYBpoaSPTI8qiVOuU9aqAcZ5EHou9cUX4PFmH/N7E7BuVIJrXsPm2C6OWn5qMKnbgensS6hjGPtxUOURxBbqcn0Y9zxhjOu578B4YAv2m6Eay4w1VJyxYnoq3WN6Nv02fbcFw5/vOu1XBC65kZyKYNh1yMZqPaqS+vVEK6Gl3PdQQneC0G3RxEetIGQLhs3K5MFPTJkDgSvB2J+uT05mMs1VCKx7bYmMmMsEBK/y1mfT8lXZWC0IZb7dW8aLwMHgPIs46y+4KsvZ9WjeDs8FUpRQItLjPJFv0NXAOgG5QWPc7svM1AUGVkIpYDocjuumwKBVWRXoFQNCy2O6l+gmAAAAAElFTkSuQmCC"/></div>
                <div className="text">Rapid P2P Sharing.</div>
                </div>

                <div className='feat'>
                <div className="icon"><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAeCAYAAAA7MK6iAAAACXBIWXMAAAsTAAALEwEAmpwYAAACdklEQVR4nO2VS2tTURDHL/jAN6io4CcQn6gbKSVzkloRLFLRM3NrC10Irly4clG0PtamEv0Wbmo3FqvNTGItgtWKxrpRRHAhIlSi+KAtyuS2yblJ7k3clgzczeX85vk/czyvZS1r2bKz5Li/xwjdAsECCP4AoW+G8QUwXWnP221R3NEJfycwXgehl8oELBaM4FAqb3dHBrQFu9oI3QaheSP0t94HQl+BsbuaBfbPGKHZGG4eGDOHp86vqg3KOBYF1jqxPUusyREB40IzrGEcCwU3gnfCzvGeyVrofNC3Xj+T9U8YwbcVB/QzOY4HApYGHe4dCNmOh91blQMmY4SGQ74ZM+WZhtuLl+qN4tik3QJMb5xzz+xdu6JrqmsdCH0yjDOdT/q212PVp9ux0sxVSE5Gw5Ei8DwvIf5BYPpTPp+z/cGM0U+I3RfHAuOIU3XaC1WRtRAHL2Z/w6n6g+qjERMkjUmnwNeeYSpWMrEbGjlomzi50TB9qTB0oZnAbcpVNFL878BqwHjREdRnFVIj5vjT3k2hwMElb77VQeD+NcD00WndYCPGZKkj3GrBoWbFBYx79bqUHOXonKPU36m8vz82MON9Zzw3PZV2M9cp9cjfoVdGKz0yadcCw0ojNO1W0f747Oa6QQWvOufmgHt2LVWSqbrkI6pCnbkug6RYBMb3zpmBUjI5PGQEfzmbaUaXjXIlMZXai6NVvtPljHSNNb0yGRfCKxN74/Z7+MPRmn2tP7TyBk5mTRZPV7cyIf4pfUBiuDmtVMcTKYLSzBnTOjMj9H3x1ZkGpmv69EVx+mQC42Vgeh48pVQ0TK9USOWZtqxly9r+AVS7cJDuarlhAAAAAElFTkSuQmCC"/></div>
                <div className="text">Unlimited File Sizes</div>
                <div className="icon"><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAeCAYAAAA7MK6iAAAACXBIWXMAAAsTAAALEwEAmpwYAAABz0lEQVR4nO2WzUoDMRDH9wX0IHjwE59DbJNKERUtStmZhT6BH9Vn8aaoF4/e/TiImdUivoEVb+0T2HqzooytWiuZTXcteujAwBIy+8t/MpnE8/r23yx77U8qA0VFeK4Iy4rgqen8jefK4GYqxIlfA85e+GPKwJ4ibGjCV8mVgRdNeKwMTiWCKgMrmrAeBfzhBmsZCnKxoJpwu6WgO+g39cFW10pVAmg73Fm5MoXxWOkV0p4tBaMOYDyUfwQVfQn56VJugD1NwSpXdsQC9qOPjFS9BipzN/5QZxyPaYKqNeWEDc6ktLdFceWXkOd5GYLFJgiqacKF91hCX4wNgw0rWBOcScGc2ta8L3UGKjw2f1sYlAsNTwQwPkjBbfOcxjvSXbaDDdZsgZkQp62Bn1vlz0jV7QmKrccoChqlWhl4FFYM970Ca4K7WMWVXDHai4uvth6C16xBfJ/aGggXThQ0TZiygJ/FBtJUDQdiI4jhyuCu08UvHavuofCYCgsjkeBWyhZcXhwO0Jc0wbIT9MP4Ek/6EODe78WxDAW5OGnn9CqDS14Sm7nyh5WBHa5MF5Wa4Mh5T51fJmGwoQ2cchdqtdc6f3Nz0ATrkUemb94f2BubbpugvgbU1gAAAABJRU5ErkJggg=="/></div>
                <div className="text">End-to-End Encryption</div>
                </div>
               

                
        </div>
      </div>
    </div>
  );
}

export default Sender;
