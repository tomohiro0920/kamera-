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
    
    // モーダル関連の要素を取得
    const historyModal = document.getElementById('history-modal');
    const closeBtn = document.querySelector('.close-btn');
    const historyGrid = document.getElementById('history-grid');

    // 変数の初期化
    let stream;
    let videoTrack;
    let mediaRecorder;
    let recordedChunks = [];
    let isRecording = false;
    let capturedDataURLs = []; 
    let currentFacingMode = "environment"; 

    // ----------------------------------------------------
    // 1. カメラへのアクセスと初期化
    // ----------------------------------------------------
    async function startCamera(facingMode) {
        try {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }

            const constraints = {
                video: {
                    facingMode: facingMode, 
                    advanced: [{ zoom: true }] 
                },
                audio: false
            };
            
            stream = await navigator.mediaDevices.getUserMedia(constraints);
            video.srcObject = stream;
            await video.play(); 

            videoTrack = stream.getVideoTracks()[0];
            currentFacingMode = facingMode; 
            
            // ズーム機能の判定と設定
            const capabilities = videoTrack.getCapabilities();
            const supportsNativeZoom = !!capabilities.zoom; 
            
            if (supportsNativeZoom) {
                // ネイティブズーム対応時
                const currentZoom = videoTrack.getSettings().zoom || 1.0;
                zoomSlider.min = capabilities.zoom.min;
                zoomSlider.max = capabilities.zoom.max;
                zoomSlider.step = capabilities.zoom.step || 0.1;
                zoomSlider.value = currentZoom;
                zoomValueSpan.textContent = `${currentZoom.toFixed(1)}x`;
                zoomSlider.disabled = false;
                // ネイティブズーム対応時はCSS拡大をリセット
                video.style.transform = (facingMode === "user") ? "scaleX(-1)" : "scaleX(1)";
            } else {
                // 非対応時 (CSS拡大で代替)
                zoomSlider.min = 1.0;
                zoomSlider.max = 3.0; // CSS拡大の限界を設定
                zoomSlider.step = 0.1;
                zoomSlider.value = 1.0;
                zoomValueSpan.textContent = '1.0x (CSS)';
                zoomSlider.disabled = false; // CSSで代替するため有効化

                // 初期状態の反転設定のみ適用
                video.style.transform = (facingMode === "user") ? "scaleX(-1)" : "scaleX(1)";
            }
            
            return true;
        } catch (err) {
            console.error(`カメラ (${facingMode}) へのアクセスに失敗しました: `, err);
            // カメラ起動失敗時はスライダーも無効化
            zoomSlider.disabled = true;
            zoomValueSpan.textContent = 'N/A';
            return false;
        }
    }

    async function initializeCamera() {
        let success = await startCamera("environment");
        if (!success) {
            await startCamera("user");
        }
    }
    
    // ----------------------------------------------------
    // 2. イベントリスナー
    // ----------------------------------------------------

    // ズームスライダー (CSS代替ロジック込み)
    zoomSlider.addEventListener('input', () => {
        const zoomLevel = parseFloat(zoomSlider.value);
        zoomValueSpan.textContent = `${zoomLevel.toFixed(1)}x`;

        if (!videoTrack) return; 

        const capabilities = videoTrack.getCapabilities();
        const supportsNativeZoom = !!capabilities.zoom;

        if (supportsNativeZoom) {
            // 1. カメラがネイティブズームに対応している場合
            videoTrack.applyConstraints({ advanced: [{ zoom: zoomLevel }] }).catch(e => console.error("WebRTCズーム設定の適用に失敗:", e));
        } else {
            // 2. カメラがネイティブズームに非対応の場合 (CSS拡大で代替)
            let transformValue = `scale(${zoomLevel})`;
            
            // 左右反転設定があれば、それも適用
            if (currentFacingMode === "user") {
                transformValue += ' scaleX(-1)';
            }
            
            // 拡大の中心を保つための上下中央寄せ (画面全体を拡大して中央部分を見せる)
            const translateY = (zoomLevel - 1) / zoomLevel * 50; 
            transformValue += ` translate(0, ${-translateY}%)`;

            video.style.transform = transformValue;
        }
    });

    // カメラ切り替えボタン
    cameraSwitchButton.addEventListener('click', async () => {
        const nextFacingMode = (currentFacingMode === "environment") ? "user" : "environment";

        if (isRecording) {
            alert("録画中はカメラを切り替えられません。一度録画を停止してください。");
            return;
        }
        
        const success = await startCamera(nextFacingMode);
        if (!success) {
            alert("カメラの切り替えに失敗しました。利用可能なカメラがない可能性があります。");
        }
    });

    // 写真のキャプチャボタン (📸) (CSSズームを考慮したキャプチャ修正)
    captureButton.addEventListener('click', () => {
        if (!stream || isRecording) return;

        const width = video.videoWidth;
        const height = video.videoHeight;
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext('2d');
        
        // 現在のズームレベルを取得
        const zoomLevel = parseFloat(zoomSlider.value);
        
        // 描画の原点を中央に移動し、ズームと反転を適用して描画
        context.translate(width / 2, height / 2);
        
        // ズーム適用 (ネイティブズームでなくても、CSSズームと同じ倍率でキャプチャする)
        context.scale(zoomLevel, zoomLevel);
        
        // フロントカメラの反転設定
        if (currentFacingMode === "user") {
            context.scale(-1, 1);
        }
        
        // 映像を描画（ズーム分を考慮して中央から描画）
        context.drawImage(video, -width / 2, -height / 2, width, height);
        
        // 設定を元に戻す
        context.setTransform(1, 0, 0, 1, 0, 0);

        const dataURL = canvas.toDataURL('image/png'); 
        addCapturedCard(dataURL, 'image');
    });

    // 動画の録画ボタン (●)
    videoButton.addEventListener('click', () => {
        if (!stream) return;

        if (isRecording) {
            // 録画停止
            mediaRecorder.stop();
            isRecording = false;
            videoButton.textContent = '●';
            videoButton.classList.remove('recording');
            captureButton.disabled = false; 
        } else {
            // 録画開始
            recordedChunks = [];
            
            mediaRecorder = new MediaRecorder(stream, { 
                mimeType: 'video/webm; codecs=vp8' 
            });

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    recordedChunks.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(recordedChunks, { type: 'video/webm' });
                const videoURL = URL.createObjectURL(blob);
                addCapturedCard(videoURL, 'video');
            };

            mediaRecorder.start();
            isRecording = true;
            videoButton.textContent = '■'; 
            videoButton.classList.add('recording'); 
            captureButton.disabled = true; 
        }
    });
    
    // 履歴カードクリックでモーダル表示
    previewArea.addEventListener('click', (e) => {
        const card = e.target.closest('.captured-card');
        if (card) {
            showHistoryModal();
        }
    });

    // モーダルを閉じる
    closeBtn.addEventListener('click', () => {
        historyModal.style.display = 'none';
    });

    window.addEventListener('click', (e) => {
        if (e.target === historyModal) {
            historyModal.style.display = 'none';
        }
    });
    
    // 最新ダウンロードボタン
    downloadLatestBtn.addEventListener('click', () => {
        if (capturedDataURLs.length > 0) {
             const latest = capturedDataURLs[0];
             downloadFile(latest.url, latest.filename);
        } else {
            alert('ダウンロードする写真や動画がありません。');
        }
    });

    // ----------------------------------------------------
    // 3. データ処理と表示
    // ----------------------------------------------------
    
    function addCapturedCard(dataURL, type = 'image') {
        const card = document.createElement('div');
        card.className = 'captured-card';
        card.title = 'クリックで履歴一覧を開く'; 
        
        let mediaElement;
        const filename = `${type}_${new Date().getTime()}.${type === 'image' ? 'png' : 'webm'}`;
        
        if (type === 'image') {
            mediaElement = document.createElement('img');
            mediaElement.className = 'captured-img';
            mediaElement.src = dataURL;
        } else if (type === 'video') {
            mediaElement = document.createElement('video');
            mediaElement.className = 'captured-video';
            mediaElement.src = dataURL;
            mediaElement.autoplay = true; 
            mediaElement.loop = true; 
            mediaElement.muted = true; 
        }
        
        card.appendChild(mediaElement);

        capturedDataURLs.unshift({ url: dataURL, filename: filename, type: type });

        previewArea.prepend(card); 
        previewArea.scrollLeft = 0; 

        if (capturedDataURLs.length > 0) {
             downloadLatestBtn.style.visibility = 'visible';
        }
    }
    
    function showHistoryModal() {
        historyGrid.innerHTML = ''; 

        if (capturedDataURLs.length === 0) {
            historyGrid.innerHTML = '<p>撮影されたデータがありません。</p>';
        } else {
            capturedDataURLs.forEach((data) => {
                const item = document.createElement('div');
                item.className = 'history-item';
                item.title = `クリックでダウンロード: ${data.filename}`;
                
                let mediaElement;
                if (data.type === 'image') {
                    mediaElement = document.createElement('img');
                    mediaElement.src = data.url;
                } else { 
                    mediaElement = document.createElement('video');
                    mediaElement.src = data.url;
                    mediaElement.muted = true;
                    mediaElement.autoplay = true;
                    mediaElement.loop = true;
                    
                    const icon = document.createElement('span');
                    icon.className = 'file-type-icon';
                    icon.textContent = '🎥';
                    item.appendChild(icon);
                }
                
                item.appendChild(mediaElement);
                
                item.addEventListener('click', () => {
                    downloadFile(data.url, data.filename);
                });

                historyGrid.appendChild(item);
            });
        }

        historyModal.style.display = 'block'; 
    }

    function downloadFile(url, filename) {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }


    // 4. アプリケーション起動
    initializeCamera();
});
