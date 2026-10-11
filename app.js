/**
 * Batch Image Resizer - 100% In-Memory Client-Side Engine
 * Operates purely within the user's browser memory (Canvas API)
 * Zero server uploads for complete data privacy.
 */

document.addEventListener('DOMContentLoaded', () => {
  // ==========================================
  // State Management
  // ==========================================
  const state = {
    mode: 'width', // 'width' | 'height' | 'long' | 'short' | 'percent'
    modeValues: {
      width: 1200,
      height: 800,
      long: 1920,
      short: 1080,
      percent: 50
    },
    format: 'image/webp',
    quality: 0.85,
    suffix: '_resized',
    items: [], // Array of image objects
    isProcessing: false
  };

  // Presets config
  const PRESETS = {
    width: [1920, 1280, 1080, 800, 640, 500, 300],
    height: [1080, 800, 720, 600, 400, 300],
    long: [2560, 1920, 1440, 1280, 1080, 800],
    short: [1080, 800, 720, 600, 480, 360],
    percent: [25, 50, 75, 80, 120, 150, 200]
  };

  const MODE_DESCRIPTIONS = {
    width: '<strong>X축(너비) 기준:</strong> 모든 이미지의 가로 폭을 입력된 픽셀로 고정하고 세로는 원본 가로세로 비율을 유지하여 자동 조절합니다.',
    height: '<strong>Y축(높이) 기준:</strong> 모든 이미지의 세로 높이를 입력된 픽셀로 고정하고 가로는 원본 가로세로 비율을 유지하여 자동 조절합니다.',
    long: '<strong>긴축 기준:</strong> 각 이미지의 더 긴 쪽(가로 사진은 너비, 세로 사진은 높이)을 입력값으로 맞추고 반대쪽을 비례 조절합니다.',
    short: '<strong>짧은축 기준:</strong> 각 이미지의 더 짧은 쪽(가로 사진은 높이, 세로 사진은 너비)을 입력값으로 맞추고 반대쪽을 비례 조절합니다.',
    percent: '<strong>퍼센트 비율 기준:</strong> 원본 이미지의 가로와 세로 해상도를 입력한 비율(%)로 균등하게 확대 또는 축소합니다.'
  };

  // ==========================================
  // DOM Elements
  // ==========================================
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const modeTabs = document.querySelectorAll('.mode-tab-btn');
  const modeDescription = document.getElementById('modeDescription');
  const dimensionInput = document.getElementById('dimensionInput');
  const dimensionUnit = document.getElementById('dimensionUnit');
  const presetChipsContainer = document.getElementById('presetChipsContainer');
  const formatSelect = document.getElementById('formatSelect');
  const suffixInput = document.getElementById('suffixInput');
  const qualityWrapper = document.getElementById('qualityWrapper');
  const qualitySlider = document.getElementById('qualitySlider');
  const qualityValueText = document.getElementById('qualityValueText');
  const btnProcessAll = document.getElementById('btnProcessAll');
  
  const imageCountBadge = document.getElementById('imageCountBadge');
  const processedCountBadge = document.getElementById('processedCountBadge');
  const btnAddMore = document.getElementById('btnAddMore');
  const btnClearAll = document.getElementById('btnClearAll');
  const btnDownloadZip = document.getElementById('btnDownloadZip');
  
  const progressBox = document.getElementById('progressBox');
  const progressStatusText = document.getElementById('progressStatusText');
  const progressPercentageText = document.getElementById('progressPercentageText');
  const progressBar = document.getElementById('progressBar');
  
  const emptyState = document.getElementById('emptyState');
  const imageGrid = document.getElementById('imageGrid');
  
  const previewModal = document.getElementById('previewModal');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const modalImg = document.getElementById('modalImg');
  const modalMeta = document.getElementById('modalMeta');
  const toastContainer = document.getElementById('toastContainer');

  // ==========================================
  // Helper Functions
  // ==========================================
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let iconSvg = '';
    if (type === 'success') {
      iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>';
    } else if (type === 'error') {
      iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
    } else {
      iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
    }

    toast.innerHTML = `${iconSvg}<span>${escapeHtml(message)}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, m => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[m]);
  }

  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    if (!bytes || isNaN(bytes)) return '-';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function getFileExtension(filename) {
    const parts = filename.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : '';
  }

  function getTargetMimeAndExt(originalMime, originalExt) {
    if (state.format === 'original') {
      let ext = originalExt;
      if (!ext) {
        if (originalMime === 'image/jpeg') ext = 'jpg';
        else if (originalMime === 'image/png') ext = 'png';
        else if (originalMime === 'image/webp') ext = 'webp';
        else ext = 'jpg';
      }
      return { mime: originalMime || 'image/jpeg', ext };
    }

    if (state.format === 'image/jpeg') return { mime: 'image/jpeg', ext: 'jpg' };
    if (state.format === 'image/png') return { mime: 'image/png', ext: 'png' };
    if (state.format === 'image/webp') return { mime: 'image/webp', ext: 'webp' };

    return { mime: 'image/jpeg', ext: 'jpg' };
  }

  // Calculate Target Dimensions for an item
  function calculateTargetDimensions(origW, origH) {
    const mode = state.mode;
    const val = parseFloat(dimensionInput.value) || 100;
    let targetW = origW;
    let targetH = origH;

    switch (mode) {
      case 'width': {
        targetW = Math.max(1, Math.round(val));
        targetH = Math.max(1, Math.round(origH * (targetW / origW)));
        break;
      }
      case 'height': {
        targetH = Math.max(1, Math.round(val));
        targetW = Math.max(1, Math.round(origH * (targetH / origH)));
        break;
      }
      case 'long': {
        // Longer edge matches val
        if (origW >= origH) {
          targetW = Math.max(1, Math.round(val));
          targetH = Math.max(1, Math.round(origH * (targetW / origW)));
        } else {
          targetH = Math.max(1, Math.round(val));
          targetW = Math.max(1, Math.round(origW * (targetH / origH)));
        }
        break;
      }
      case 'short': {
        // Shorter edge matches val
        if (origW >= origH) {
          targetH = Math.max(1, Math.round(val));
          targetW = Math.max(1, Math.round(origW * (targetH / origH)));
        } else {
          targetW = Math.max(1, Math.round(val));
          targetH = Math.max(1, Math.round(origH * (targetW / origW)));
        }
        break;
      }
      case 'percent': {
        const ratio = val / 100;
        targetW = Math.max(1, Math.round(origW * ratio));
        targetH = Math.max(1, Math.round(origH * ratio));
        break;
      }
    }

    return { targetW, targetH };
  }

  // Generate target filename
  function generateOutputFilename(originalName, targetExt) {
    const dotIndex = originalName.lastIndexOf('.');
    const baseName = dotIndex !== -1 ? originalName.substring(0, dotIndex) : originalName;
    const suffix = state.suffix || '';
    return `${baseName}${suffix}.${targetExt}`;
  }

  // Download a single blob directly in-memory
  function triggerBlobDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1500);
  }

  // ==========================================
  // Resize Algorithm: High Quality Canvas Resampling
  // ==========================================
  async function resizeImage(item) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const { targetW, targetH } = calculateTargetDimensions(item.originalWidth, item.originalHeight);
          item.targetWidth = targetW;
          item.targetHeight = targetH;

          const { mime, ext } = getTargetMimeAndExt(item.file.type, item.fileExtension);
          item.targetExt = ext;
          item.targetMime = mime;
          item.resizedFilename = generateOutputFilename(item.originalName, ext);

          // Step-down scaling for high quality anti-aliasing
          let canvas = document.createElement('canvas');
          let ctx = canvas.getContext('2d', { alpha: mime !== 'image/jpeg' });

          // Multi-step reduction if downscaling by more than 2x
          let curW = item.originalWidth;
          let curH = item.originalHeight;

          // If reduction is drastic, step down in 50% intervals to avoid aliasing artifacts
          let offscreenCanvas = canvas;
          let offscreenCtx = ctx;

          if (targetW < curW * 0.5 && targetH < curH * 0.5) {
            // intermediate stepping
            let stepW = curW;
            let stepH = curH;
            let tempCanvas = document.createElement('canvas');
            let tempCtx = tempCanvas.getContext('2d');
            tempCanvas.width = stepW;
            tempCanvas.height = stepH;
            tempCtx.drawImage(img, 0, 0);

            while (stepW * 0.5 > targetW && stepH * 0.5 > targetH) {
              stepW = Math.round(stepW * 0.5);
              stepH = Math.round(stepH * 0.5);
              const nextCanvas = document.createElement('canvas');
              nextCanvas.width = stepW;
              nextCanvas.height = stepH;
              const nextCtx = nextCanvas.getContext('2d');
              nextCtx.imageSmoothingEnabled = true;
              nextCtx.imageSmoothingQuality = 'high';
              nextCtx.drawImage(tempCanvas, 0, 0, stepW, stepH);
              tempCanvas = nextCanvas;
            }

            canvas.width = targetW;
            canvas.height = targetH;
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            if (mime === 'image/jpeg') {
              ctx.fillStyle = '#FFFFFF';
              ctx.fillRect(0, 0, targetW, targetH);
            }
            ctx.drawImage(tempCanvas, 0, 0, targetW, targetH);
          } else {
            // direct render
            canvas.width = targetW;
            canvas.height = targetH;
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            if (mime === 'image/jpeg') {
              ctx.fillStyle = '#FFFFFF';
              ctx.fillRect(0, 0, targetW, targetH);
            }
            ctx.drawImage(img, 0, 0, targetW, targetH);
          }

          // Export to Blob
          const quality = (mime === 'image/jpeg' || mime === 'image/webp') ? state.quality : undefined;
          canvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error('Canvas toBlob failed'));
              return;
            }

            // Cleanup old blob url if exists
            if (item.resizedBlobUrl) {
              URL.revokeObjectURL(item.resizedBlobUrl);
            }

            item.resizedBlob = blob;
            item.resizedBlobUrl = URL.createObjectURL(blob);
            item.resizedSize = blob.size;
            item.status = 'done';

            resolve(item);
          }, mime, quality);

        } catch (err) {
          item.status = 'error';
          reject(err);
        }
      };

      img.onerror = (err) => {
        item.status = 'error';
        reject(err);
      };

      img.src = item.originalBlobUrl;
    });
  }

  // ==========================================
  // Preset & Mode Tab Management
  // ==========================================
  function updatePresets() {
    const list = PRESETS[state.mode] || [];
    presetChipsContainer.innerHTML = '';
    
    list.forEach(val => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'preset-chip-btn';
      btn.textContent = state.mode === 'percent' ? `${val}%` : `${val}px`;
      btn.addEventListener('click', () => {
        dimensionInput.value = val;
        state.modeValues[state.mode] = val;
        onDimensionSettingsChanged();
      });
      presetChipsContainer.appendChild(btn);
    });
  }

  function setMode(mode) {
    state.mode = mode;
    modeTabs.forEach(tab => {
      const isActive = tab.dataset.mode === mode;
      tab.classList.toggle('active', isActive);
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    modeDescription.innerHTML = MODE_DESCRIPTIONS[mode] || '';

    if (mode === 'percent') {
      dimensionUnit.textContent = '%';
      dimensionInput.min = '1';
      dimensionInput.max = '1000';
      dimensionInput.step = '5';
    } else {
      dimensionUnit.textContent = 'px';
      dimensionInput.min = '1';
      dimensionInput.max = '10000';
      dimensionInput.step = '1';
    }

    dimensionInput.value = state.modeValues[mode] || 1000;
    updatePresets();
    onDimensionSettingsChanged();
  }

  function onDimensionSettingsChanged() {
    state.modeValues[state.mode] = parseFloat(dimensionInput.value) || 100;
    // Mark items that dimension changed so preview updates
    state.items.forEach(item => {
      const { targetW, targetH } = calculateTargetDimensions(item.originalWidth, item.originalHeight);
      item.targetWidth = targetW;
      item.targetHeight = targetH;
      // If done, invalidate done state so user knows to reprocess or can download new preview
      updateCardUI(item);
    });
    updateHeaderStats();
  }

  // ==========================================
  // File Ingestion & Processing Pipeline
  // ==========================================
  async function handleFiles(files) {
    if (!files || files.length === 0) return;

    const validFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (validFiles.length === 0) {
      showToast('지원되는 이미지 파일(JPG, PNG, WebP 등)을 선택해 주세요.', 'error');
      return;
    }

    let addedCount = 0;
    for (const file of validFiles) {
      const id = 'img_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
      const originalBlobUrl = URL.createObjectURL(file);
      
      try {
        const { width, height } = await getImageDimensions(originalBlobUrl);
        const { targetW, targetH } = calculateTargetDimensions(width, height);
        
        const item = {
          id,
          file,
          originalName: file.name,
          originalSize: file.size,
          originalWidth: width,
          originalHeight: height,
          originalAspectRatio: (width / height).toFixed(2),
          originalBlobUrl,
          fileExtension: getFileExtension(file.name),
          targetWidth: targetW,
          targetHeight: targetH,
          resizedBlob: null,
          resizedBlobUrl: null,
          resizedSize: null,
          resizedFilename: null,
          status: 'pending'
        };

        state.items.push(item);
        renderCard(item);
        addedCount++;
      } catch (err) {
        console.error('Failed to load image:', file.name, err);
      }
    }

    if (addedCount > 0) {
      showToast(`${addedCount}개의 이미지를 불러왔습니다.`, 'success');
      updateUIState();
    }
  }

  function getImageDimensions(blobUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = reject;
      img.src = blobUrl;
    });
  }

  // ==========================================
  // UI Rendering & Updates
  // ==========================================
  function updateUIState() {
    const hasItems = state.items.length > 0;
    emptyState.style.display = hasItems ? 'none' : 'flex';
    imageGrid.style.display = hasItems ? 'grid' : 'none';
    
    btnProcessAll.disabled = !hasItems || state.isProcessing;
    btnClearAll.disabled = !hasItems || state.isProcessing;
    btnDownloadZip.disabled = !hasItems || state.isProcessing;

    updateHeaderStats();
  }

  function updateHeaderStats() {
    const total = state.items.length;
    const completed = state.items.filter(i => i.status === 'done').length;

    imageCountBadge.textContent = `등록된 이미지: ${total}개`;
    
    if (completed > 0) {
      processedCountBadge.style.display = 'inline-block';
      processedCountBadge.textContent = `변환 완료: ${completed}개`;
    } else {
      processedCountBadge.style.display = 'none';
    }
  }

  function renderCard(item) {
    const card = document.createElement('div');
    card.className = 'img-card';
    card.id = `card-${item.id}`;

    card.innerHTML = `
      <div class="img-card-preview">
        <img src="${item.originalBlobUrl}" alt="${escapeHtml(item.originalName)}" id="preview-img-${item.id}">
        <button type="button" class="btn-card-zoom" title="크게 보기" data-id="${item.id}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
        </button>
        <button type="button" class="btn-card-remove" title="삭제" data-id="${item.id}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
        <span class="card-status-badge badge-ready" id="status-badge-${item.id}">대기중</span>
      </div>

      <div class="img-card-body">
        <div class="img-card-title" title="${escapeHtml(item.originalName)}">${escapeHtml(item.originalName)}</div>
        
        <div class="dim-comparison-grid">
          <div class="dim-col">
            <span class="dim-col-label">원본 크기</span>
            <span class="dim-col-val">${item.originalWidth} × ${item.originalHeight}</span>
            <span class="dim-col-size">${formatBytes(item.originalSize)}</span>
          </div>
          <div class="dim-col">
            <span class="dim-col-label">리사이즈 목표</span>
            <span class="dim-col-val target-val" id="target-dim-${item.id}">${item.targetWidth} × ${item.targetHeight}</span>
            <span class="dim-col-size" id="target-size-${item.id}">예상 크기</span>
          </div>
        </div>

        <div class="img-card-actions">
          <button type="button" class="btn-card-download" data-id="${item.id}" id="btn-download-${item.id}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            <span class="btn-text">개별 다운로드</span>
          </button>
        </div>
      </div>
    `;

    // Event listeners on card buttons
    card.querySelector('.btn-card-remove').addEventListener('click', (e) => {
      e.stopPropagation();
      removeItem(item.id);
    });

    card.querySelector('.btn-card-zoom').addEventListener('click', (e) => {
      e.stopPropagation();
      openPreviewModal(item);
    });

    card.querySelector('.btn-card-download').addEventListener('click', async (e) => {
      e.stopPropagation();
      await handleSingleDownload(item);
    });

    imageGrid.appendChild(card);
  }

  function updateCardUI(item) {
    const card = document.getElementById(`card-${item.id}`);
    if (!card) return;

    const targetDimEl = document.getElementById(`target-dim-${item.id}`);
    const targetSizeEl = document.getElementById(`target-size-${item.id}`);
    const statusBadge = document.getElementById(`status-badge-${item.id}`);
    const previewImg = document.getElementById(`preview-img-${item.id}`);

    if (targetDimEl) {
      targetDimEl.textContent = `${item.targetWidth} × ${item.targetHeight}`;
    }

    if (item.status === 'done' && item.resizedSize) {
      statusBadge.textContent = '완료';
      statusBadge.className = 'card-status-badge badge-done';
      
      const diffPercent = Math.round(((item.resizedSize - item.originalSize) / item.originalSize) * 100);
      const sign = diffPercent > 0 ? '+' : '';
      const color = diffPercent <= 0 ? '#10b981' : '#f59e0b';
      
      targetSizeEl.innerHTML = `<span style="color: ${color}">${formatBytes(item.resizedSize)} (${sign}${diffPercent}%)</span>`;
      
      if (item.resizedBlobUrl) {
        previewImg.src = item.resizedBlobUrl;
      }
    } else if (item.status === 'processing') {
      statusBadge.textContent = '변환중...';
      statusBadge.className = 'card-status-badge badge-ready';
      targetSizeEl.textContent = '처리 중...';
    } else {
      statusBadge.textContent = '대기중';
      statusBadge.className = 'card-status-badge badge-ready';
      targetSizeEl.textContent = '예상 크기';
    }
  }

  function removeItem(id) {
    const index = state.items.findIndex(i => i.id === id);
    if (index !== -1) {
      const item = state.items[index];
      if (item.originalBlobUrl) URL.revokeObjectURL(item.originalBlobUrl);
      if (item.resizedBlobUrl) URL.revokeObjectURL(item.resizedBlobUrl);
      
      state.items.splice(index, 1);
      
      const card = document.getElementById(`card-${id}`);
      if (card) card.remove();

      updateUIState();
      showToast('이미지가 목록에서 삭제되었습니다.', 'info');
    }
  }

  function clearAllItems() {
    if (state.items.length === 0) return;
    
    state.items.forEach(item => {
      if (item.originalBlobUrl) URL.revokeObjectURL(item.originalBlobUrl);
      if (item.resizedBlobUrl) URL.revokeObjectURL(item.resizedBlobUrl);
    });

    state.items = [];
    imageGrid.innerHTML = '';
    updateUIState();
    showToast('모든 이미지가 초기화되었습니다.', 'info');
  }

  // ==========================================
  // Single Download
  // ==========================================
  async function handleSingleDownload(item) {
    try {
      const btn = document.getElementById(`btn-download-${item.id}`);
      if (btn) btn.disabled = true;

      // If not yet resized or parameters changed, resize on the fly
      if (item.status !== 'done' || !item.resizedBlob) {
        item.status = 'processing';
        updateCardUI(item);
        await resizeImage(item);
        updateCardUI(item);
      }

      triggerBlobDownload(item.resizedBlob, item.resizedFilename);
      showToast(`${item.resizedFilename} 다운로드를 시작합니다.`, 'success');
      updateHeaderStats();
    } catch (err) {
      console.error(err);
      showToast('이미지 변환 및 다운로드 중 오류가 발생했습니다.', 'error');
    } finally {
      const btn = document.getElementById(`btn-download-${item.id}`);
      if (btn) btn.disabled = false;
    }
  }

  // ==========================================
  // Batch Execution & ZIP Generation
  // ==========================================
  async function processAllImages() {
    if (state.items.length === 0 || state.isProcessing) return;

    state.isProcessing = true;
    updateUIState();

    progressBox.style.display = 'flex';
    progressBar.style.width = '0%';
    progressStatusText.textContent = '이미지 일괄 리사이징 시작...';
    progressPercentageText.textContent = '0%';

    const total = state.items.length;
    let completed = 0;

    for (let i = 0; i < total; i++) {
      const item = state.items[i];
      item.status = 'processing';
      updateCardUI(item);

      progressStatusText.textContent = `리사이징 중 (${i + 1}/${total}): ${item.originalName}`;

      try {
        await resizeImage(item);
        updateCardUI(item);
      } catch (err) {
        console.error('Error processing:', item.originalName, err);
      }

      completed++;
      const percent = Math.round((completed / total) * 100);
      progressBar.style.width = `${percent}%`;
      progressPercentageText.textContent = `${percent}%`;

      // Allow UI tick to update smoothly
      await new Promise(r => setTimeout(r, 20));
    }

    state.isProcessing = false;
    updateUIState();

    progressStatusText.textContent = `모든 이미지 리사이징 완료! (총 ${total}장)`;
    setTimeout(() => {
      progressBox.style.display = 'none';
    }, 3500);

    showToast(`총 ${total}개의 이미지가 성공적으로 리사이징되었습니다!`, 'success');
  }

  async function handleBatchZipDownload() {
    if (state.items.length === 0 || state.isProcessing) return;

    if (typeof JSZip === 'undefined') {
      showToast('압축 라이브러리(JSZip)를 불러올 수 없습니다.', 'error');
      return;
    }

    state.isProcessing = true;
    updateUIState();

    progressBox.style.display = 'flex';
    progressBar.style.width = '0%';
    progressStatusText.textContent = '이미지 확인 및 일괄 변환 점검 중...';
    progressPercentageText.textContent = '0%';

    // Step 1: Ensure all items are resized
    const total = state.items.length;
    for (let i = 0; i < total; i++) {
      const item = state.items[i];
      if (item.status !== 'done' || !item.resizedBlob) {
        progressStatusText.textContent = `변환 진행 중 (${i + 1}/${total}): ${item.originalName}`;
        item.status = 'processing';
        updateCardUI(item);
        try {
          await resizeImage(item);
          updateCardUI(item);
        } catch (err) {
          console.error('Resize failed for zip:', item.originalName, err);
        }
      }
      const percent = Math.round(((i + 1) / total) * 60); // 0-60% for resizing
      progressBar.style.width = `${percent}%`;
      progressPercentageText.textContent = `${percent}%`;
      await new Promise(r => setTimeout(r, 10));
    }

    // Step 2: Bundle into JSZip
    progressStatusText.textContent = 'ZIP 압축 패키지 생성 중...';
    const zip = new JSZip();

    // Prevent duplicate filenames in zip
    const nameCountMap = {};

    state.items.forEach(item => {
      if (item.resizedBlob) {
        let filename = item.resizedFilename || 'image.jpg';
        if (nameCountMap[filename]) {
          const parts = filename.split('.');
          const ext = parts.pop();
          const base = parts.join('.');
          nameCountMap[filename]++;
          filename = `${base}_(${nameCountMap[filename]}).${ext}`;
        } else {
          nameCountMap[filename] = 1;
        }

        zip.file(filename, item.resizedBlob);
      }
    });

    try {
      const zipBlob = await zip.generateAsync(
        { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
        (metadata) => {
          const zipPercent = Math.round(60 + (metadata.percent * 0.4)); // 60-100%
          progressBar.style.width = `${zipPercent}%`;
          progressPercentageText.textContent = `${zipPercent}%`;
          progressStatusText.textContent = `ZIP 압축 중... (${Math.round(metadata.percent)}%)`;
        }
      );

      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const zipName = `resized_images_${dateStr}.zip`;

      triggerBlobDownload(zipBlob, zipName);
      showToast(`ZIP 압축 완료: ${zipName} 다운로드 시작!`, 'success');

      progressStatusText.textContent = 'ZIP 다운로드 완료!';
      setTimeout(() => {
        progressBox.style.display = 'none';
      }, 3000);

    } catch (err) {
      console.error('ZIP generation failed:', err);
      showToast('ZIP 압축 파일 생성 중 오류가 발생했습니다.', 'error');
    } finally {
      state.isProcessing = false;
      updateUIState();
    }
  }

  // ==========================================
  // Modal Preview
  // ==========================================
  function openPreviewModal(item) {
    const isDone = item.status === 'done' && item.resizedBlobUrl;
    modalImg.src = isDone ? item.resizedBlobUrl : item.originalBlobUrl;
    
    document.getElementById('modalTitle').textContent = item.originalName;
    modalMeta.innerHTML = `
      <div><strong>상태:</strong> ${isDone ? '리사이즈 완료' : '원본 미리보기'}</div>
      <div><strong>해상도:</strong> ${isDone ? `${item.targetWidth} × ${item.targetHeight} px` : `${item.originalWidth} × ${item.originalHeight} px`}</div>
      <div><strong>용량:</strong> ${isDone ? formatBytes(item.resizedSize) : formatBytes(item.originalSize)}</div>
    `;

    previewModal.classList.add('active');
  }

  function closePreviewModal() {
    previewModal.classList.remove('active');
    modalImg.src = '';
  }

  // ==========================================
  // Event Listeners
  // ==========================================
  // Mode selection tabs
  modeTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      setMode(tab.dataset.mode);
    });
  });

  // Dimension input changed
  dimensionInput.addEventListener('input', () => {
    onDimensionSettingsChanged();
  });

  // Format selection
  formatSelect.addEventListener('change', (e) => {
    state.format = e.target.value;
    const isLossy = state.format === 'image/jpeg' || state.format === 'image/webp';
    qualityWrapper.style.display = isLossy ? 'block' : 'none';
    
    // Invalidate rendered states to prompt re-render if needed
    onDimensionSettingsChanged();
  });

  // Quality Slider
  qualitySlider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    state.quality = val / 100;
    qualityValueText.textContent = `${val}%`;
    onDimensionSettingsChanged();
  });

  // Suffix Input
  suffixInput.addEventListener('input', (e) => {
    state.suffix = e.target.value;
    onDimensionSettingsChanged();
  });

  // Batch action buttons
  btnProcessAll.addEventListener('click', processAllImages);
  btnDownloadZip.addEventListener('click', handleBatchZipDownload);
  btnClearAll.addEventListener('click', clearAllItems);
  btnAddMore.addEventListener('click', () => fileInput.click());

  // Modal close handlers
  modalCloseBtn.addEventListener('click', closePreviewModal);
  previewModal.addEventListener('click', (e) => {
    if (e.target === previewModal) closePreviewModal();
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && previewModal.classList.contains('active')) {
      closePreviewModal();
    }
  });

  // Drag and drop handlers
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('drag-active');
  });

  dropzone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag-active');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag-active');
    if (e.dataTransfer && e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files) {
      handleFiles(e.target.files);
      fileInput.value = ''; // Reset for re-selection of same file if needed
    }
  });

  // Allow drop anywhere on body
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => {
    if (e.target !== dropzone && !dropzone.contains(e.target)) {
      e.preventDefault();
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    }
  });

  // Initialize
  setMode('width');
  updateUIState();
});
