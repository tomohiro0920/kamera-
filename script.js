document.addEventListener('DOMContentLoaded', (event) => {
    // UI要素の取得
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const captureButton = document.getElementById('capture-btn');
    const videoButton = document.getElementById('video-btn');
    const zoomSlider = document.getElementById('zoom-slider');
    const zoomValueSpan = document.getElementById('zoom-value');
    const previewArea = document.getElementById('preview-area');
    const downloadLatestBtn = document.getElementById('download-latest-btn');
    const cameraSwitchButton = document.getElementById('camera-switch-btn');
    const loadingMessage = document.getElementById('loading-message');
    const overlayControls = document.querySelector('.video-overlay-controls');
    
    // 変数の初期化
    let stream;
    let videoTrack;
    let mediaRecorder;
    let recordedChunks = [];
    let isRecording = false;
    let capturedDataURLs = []; 
    let currentFacingMode = "environment"; 


    // ----------------------------------------------------
    // UI要素の表示/非表示を切り替える関数
    // ----------------------------------------------------
    function setUIState(isReady) {
        if (isReady) {
            loadingMessage.style.display = 'none';
            video.style.visibility = 'visible';
            overlayControls.style.visibility = 'visible';
            cameraSwitchButton.disabled = false;
            captureButton.disabled = false;
            videoButton.disabled = false;
        } else {
            loadingMessage.style.display = 'block';
            video.style.visibility = 'hidden';
            overlayControls.style.visibility = 'hidden';
            cameraSwitchButton.disabled = true;
            captureButton.disabled = true;
            videoButton.disabled = true;
        }
    }


    // ----------------------------------------------------
    // 1. カメラへのアクセスと映像の表示 (デジタルズーム用に修正)
    // ----------------------------------------------------
    async function startCamera(facingMode) {
        try {
            setUIState(false);
            loadingMessage.innerHTML = "カメラへのアクセスを待機中です...<br>ブラウザのポップアップで「許可」を選択してください。";

            if (stream) {
                stream.getTracks().forEach(track => track.stop());
                stream = null;
            }

            const constraints = {
                video: {
                    facingMode: facingMode, 
                    // ハードウェアズーム制約は削除または無視
                },
                audio: false
            };
            
            stream = await navigator.mediaDevices.getUserMedia(constraints);
            video.srcObject = stream;
            await video.play(); 

            videoTrack = stream.getVideoTracks()[0];
            currentFacingMode = facingMode; 
            
            // ⭐デジタルズーム用の設定 (常に有効)⭐
            zoomSlider.min = 1.0; 
            zoomSlider.max = 3.0; // 最大3倍
            zoomSlider.step = 0.1;
            zoomSlider.value = 1.0;
            zoomValueSpan.textContent = '1.0x';
            zoomSlider.disabled = false; 

            // フロントカメラ ("user") の場合、映像を左右反転させる (ズーム値も初期値1.0で適用)
            if (facingMode === "user") {
                video.style.transform = "scaleX(-1) scale(1.0)";
            } else {
                video.style.transform = "scaleX(1) scale(1.0)";
            }
            
            setUIState(true);
            return true;
        } catch (err) {
            console.error(`カメラ (${facingMode}) へのアクセスに失敗しました: `, err);
            
            if (err.name === "NotAllowedError" || err.name === "SecurityError") {
                loadingMessage.innerHTML = "🚫 **カメラの使用が拒否されました。**<br>ブラウザのURLバーにあるカメラアイコンの設定を確認し、「許可」に変更してからページをリロードしてください。";
            } else if (err.name === "NotFoundError" || err.name === "OverconstrainedError") {
                loadingMessage.innerHTML = "📸 カメラが見つかりませんでした。<br>別のカメラ設定を試みます。";
            } else {
                 loadingMessage.innerHTML = `エラー発生 (${err.name}): ${err.message}<br>カメラが接続されているか、他のアプリで使用されていないか確認してください。`;
            }

            setUIState(false);
            return false;
        }
    }

    async function initializeCamera() {
        // 起動ロジックは変更なし
        let success = await startCamera("environment");
        
        if (!success) {
            success = await startCamera("user");
        }

        if (!success) {
            console.warn("すべてのfacingModeで失敗したため、facingModeなしで再試行します。");
            try {
                if (stream) stream.getTracks().forEach(track => track.stop());
                
                const constraints = { video: true, audio: false };
                stream = await navigator.mediaDevices.getUserMedia(constraints);
                video.srcObject = stream;
                await video.play();
                currentFacingMode = "default"; 
                setUIState(true); 
                
            } catch (e) {
                console.error("最終的なカメラ起動に失敗しました。", e);
                loadingMessage.innerHTML = "❌ カメラの起動に最終的に失敗しました。カメラが接続されているか、他のアプリで使用されていないか確認してください。";
            }
        }
    }
    
    // ----------------------------------------------------
    // 2. イベントリスナーと機能の実装
    // ----------------------------------------------------
    
    // ⭐ズームスライダーのイベントリスナー (デジタルズーム)⭐
    zoomSlider.addEventListener('input', () => {
        const zoomLevel = parseFloat(zoomSlider.value);
        zoomValueSpan.textContent = `${zoomLevel.toFixed(1)}x`;
        
        // CSSのtransformプロパティを使って映像を拡大する
        if (currentFacingMode === "user") {
            // フロントカメラ: 反転と拡大
            video.style.transform = `scaleX(-1) scale(${zoomLevel})`;
        } else {
            // バックカメラ: 拡大のみ
            video.style.transform = `scaleX(1) scale(${zoomLevel})`;
        }
    });

    // カメラ切り替えボタン (ロジックは変更なし)
    cameraSwitchButton.addEventListener('click', async () => {
        const nextFacingMode = (currentFacingMode === "environment" || currentFacingMode === "default") ? "user" : "environment";

        if (isRecording) {
            alert("録画中はカメラを切り替えられません。一度録画を停止してください。");
            return;
        }
        
        const success = await startCamera(nextFacingMode);

        if (!success) {
            await startCamera(currentFacingMode);
            alert("カメラの切り替えに失敗しました。このデバイスで利用可能なカメラは1つのみの可能性があります。");
        }
    });
    
    // 写真のキャプチャボタン (ロジックは変更なし)
    captureButton.addEventListener('click', () => {
        if (!stream) return;
        
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const ctx = canvas.getContext('2d');
        
        // フロントカメラの場合は左右反転させて描画（保存時に反転を修正）
        if (currentFacingMode === "user") {
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
        }
        
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        
        const dataURL = canvas.toDataURL('image/png');
        addCapturedCard(dataURL, 'image');
        
        capturedDataURLs.unshift({ url: dataURL, type: 'image', timestamp: new Date() });
        downloadLatestBtn.style.visibility = 'visible';
    });

    // 動画の録画ボタン (ロジックは変更なし)
    videoButton.addEventListener('click', () => {
        if (!stream) return;
        
        if (!isRecording) {
            recordedChunks = [];
            
            try {
                mediaRecorder = new MediaRecorder(stream);
            } catch (e) {
                alert('このブラウザは動画録画に対応していません。');
                return;
            }

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    recordedChunks.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const mimeType = recordedChunks[0].type || 'video/webm';
                const blob = new Blob(recordedChunks, { type: mimeType });
                const url = URL.createObjectURL(blob);
                
                addCapturedCard(url, 'video');

                capturedDataURLs.unshift({ url: url, type: 'video', timestamp: new Date() });
                downloadLatestBtn.style.visibility = 'visible';
            };

            mediaRecorder.start();
            isRecording = true;
            videoButton.classList.add('recording');
            videoButton.innerHTML = '■'; 
            captureButton.disabled = true;
            cameraSwitchButton.disabled = true;

        } else {
            mediaRecorder.stop();
            isRecording = false;
            videoButton.classList.remove('recording');
            videoButton.innerHTML = '●'; 
            captureButton.disabled = false;
            cameraSwitchButton.disabled = false;
        }
    });
    
    // 撮影履歴（カード）の作成と追加 (ロジックは変更なし)
    function addCapturedCard(dataURL, type = 'image') {
        const card = document.createElement('div');
        card.className = 'captured-card';
        card.title = (type === 'image' ? '画像' : '動画') + 'ファイル。クリックでダウンロード';
        
        let mediaElement;
        if (type === 'image') {
            mediaElement = document.createElement('img');
            mediaElement.src = dataURL;
            mediaElement.className = 'captured-img';
        } else if (type === 'video') {
            mediaElement = document.createElement('video');
            mediaElement.src = dataURL;
            mediaElement.className = 'captured-video';
            mediaElement.autoplay = false;
            mediaElement.loop = true;
            mediaElement.muted = true;
            mediaElement.controls = false;
        }

        card.appendChild(mediaElement);

        card.addEventListener('click', () => {
            const tempA = document.createElement('a');
            const timestamp = new Date().getTime();
            const extension = type === 'image' ? 'png' : 'webm';
            tempA.download = `capture_${timestamp}.${extension}`;
            tempA.href = dataURL;
            document.body.appendChild(tempA);
            tempA.click();
            document.body.removeChild(tempA);
            alert(`${type === 'image' ? '画像' : '動画'}をダウンロードしました。`);
        });

        previewArea.prepend(card);
    }
    
    // ダウンロードボタン (ロジックは変更なし)
    downloadLatestBtn.addEventListener('click', () => {
        if (capturedDataURLs.length === 0) {
            alert("保存できるファイルがありません。");
            return;
        }
        
        const latest = capturedDataURLs[0];
        const a = document.createElement('a');
        
        const timestamp = new Date().getTime();
        const extension = latest.type === 'image' ? 'png' : 'webm';
        a.download = `capture_${timestamp}.${extension}`;
        
        a.href = latest.url;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        alert(`最新の${latest.type === 'image' ? '画像' : '動画'}をダウンロードしました。`);
    });

    // 4. アプリケーション起動
    initializeCamera();
});
