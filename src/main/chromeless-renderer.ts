document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM Content Loaded');

  const statusText = document.getElementById('status-text');
  if (!statusText) {
    console.error('Could not find status-text element');
    return;
  }

  const progressBar = document.getElementById('progress-bar');
  if (!progressBar) {
    console.error('Could not find progress-bar element');
    return;
  }

  let progress = 0;
  const updateProgress = () => {
    try {
      progress += 10;
      progressBar.style.width = `${progress}%`;
      statusText.textContent = `Progress: ${progress}%`;

      if (progress < 100) {
        setTimeout(updateProgress, 500);
      } else {
        statusText.textContent = 'Completed!';
      }
    } catch (error) {
      console.error('Error updating progress:', error);
    }
  };

  updateProgress();
});
