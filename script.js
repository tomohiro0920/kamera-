document.addEventListener('DOMContentLoaded', (event) => {
    // UI要素の取得
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const captureButton = document.getElementById('capture-btn');
    const videoButton = document.getElementById('video-btn');
    const zoomSlider = document.getElementById('zoom-slider');
    const zoomValueSpan = document.getElementById('zoom-value');
    const previewArea = document.getElementById('preview-area');
    const cameraSwitchButton = document.getElementById('camera-switch-btn');
    
    // ⭐モーダル関連の要素を取得⭐
    const historyModal = document.getElementById('history-modal');
    const closeBtn = document.querySelector('.close-btn');
    const historyGrid = document.getElementById('history-grid');

    // 変数の初期化
    let stream;
    let videoTrack;
    let mediaRecorder;
    let recordedChunks = [];
    let isRecording = false;
    let capturedDataURLs = []; // 撮影した全データ {url: dataURL, filename: name, type: 'image'/'video'} を保持
    let currentFacingMode = "environment"; 
    
    // ... (startCamera, initializeCamera, ズームスライダー, カメラ切り替えボタン のロジックは前回と同様なので省略) ...
    // --- 簡潔化のため、ロジック部分は省略し、新規・変更部分のみ記述します ---

    // ----------------------------------------------------
    // 2. イベントリスナー (モーダル関連)
    // ----------------------------------------------------

    // 履歴カードをクリックしたときの処理 (⭐変更点⭐)
    // 履歴エリア全体にイベントリスナーを設定
    previewArea.addEventListener('click', (e) => {
        const card = e.target.closest('.captured-card');
        if (card) {
            showHistoryModal();
        }
    });

    // モーダルを閉じるボタン
    closeBtn.addEventListener('click', () => {
        historyModal.style.display = 'none';
    });

    // モーダルの外側をクリックしたら閉じる
    window.addEventListener('click', (e) => {
        if (e.target === historyModal) {
            historyModal.style.display = 'none';
        }
    });


    // ----------------------------------------------------
    // 3. 撮影履歴（カード）の作成とデータ保存 (⭐変更点⭐)
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

        // ダウンロード用のデータセットに保持 (最新のものが先頭)
        capturedDataURLs.unshift({ url: dataURL, filename: filename, type: type });

        // 履歴エリアの先頭（右端）に追加
        previewArea.prepend(card); 
        
        // 履歴エリアをスクロールして最新のものが見えるようにする
        previewArea.scrollLeft = 0; 

        // 初めてデータが追加されたらボタンを表示
        if (capturedDataURLs.length === 1) {
             downloadLatestBtn.style.visibility = 'visible';
        }
    }
    
    // ----------------------------------------------------
    // 4. モーダルウィンドウの表示と一覧生成 (⭐新規機能⭐)
    // ----------------------------------------------------
    function showHistoryModal() {
        historyGrid.innerHTML = ''; // グリッドをクリア

        if (capturedDataURLs.length === 0) {
            historyGrid.innerHTML = '<p>撮影されたデータがありません。</p>';
        } else {
            // 全ての撮影データをグリッドに追加
            capturedDataURLs.forEach((data, index) => {
                const item = document.createElement('div');
                item.className = 'history-item';
                item.title = `クリックでダウンロード: ${data.filename}`;
                
                let mediaElement;
                if (data.type === 'image') {
                    mediaElement = document.createElement('img');
                    mediaElement.src = data.url;
                } else { // video
                    mediaElement = document.createElement('video');
                    mediaElement.src = data.url;
                    mediaElement.muted = true;
                    mediaElement.autoplay = true;
                    mediaElement.loop = true;
                    
                    // 動画であることを示すアイコン
                    const icon = document.createElement('span');
                    icon.className = 'file-type-icon';
                    icon.textContent = '🎥';
                    item.appendChild(icon);
                }
                
                item.appendChild(mediaElement);
                
                // モーダルのアイテムをクリックでダウンロード
                item.addEventListener('click', () => {
                    downloadFile(data.url, data.filename);
                });

                historyGrid.appendChild(item);
            });
        }

        historyModal.style.display = 'block'; // モーダルを表示
    }

    // ----------------------------------------------------
    // 5. ダウンロード実行関数
    // ----------------------------------------------------
    function downloadFile(url, filename) {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
    
    // ----------------------------------------------------
    // 6. 一括ダウンロードボタンの機能 (最新をダウンロードに戻す)
    // ----------------------------------------------------
    downloadLatestBtn.addEventListener('click', () => {
        if (capturedDataURLs.length > 0) {
             const latest = capturedDataURLs[0];
             downloadFile(latest.url, latest.filename);
        } else {
            alert('ダウンロードする写真や動画がありません。');
        }
    });

    // ... (initializeCamera() の呼び出し) ...
    // --- (省略したロジックの補完) ---
    // [この下に、前回の startCamera, initializeCamera, zoomSliderリスナー, cameraSwitchリスナー, captureButtonリスナー, videoButtonリスナー の完全なコードを配置してください。]

    // 4. アプリケーション起動
    initializeCamera();
});
