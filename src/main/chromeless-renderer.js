document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM Content Loaded');

  const categoryText = document.getElementById('category-text');
  const progressBar = document.getElementById('progress-bar');
  const progressText = document.getElementById('progress-text');

  if (!categoryText || !progressBar || !progressText) {
    console.error('Could not find required elements');
    return;
  }

  // Listen for category updates
  if (window.electron) {
    window.electron.onCategoryUpdate((category) => {
      console.log('Category update received:', category);
      categoryText.textContent = category.name || 'No Category';
      document.body.style.background = category.color;

      // Update progress
      const progress = category.progress || 0;
      progressBar.style.width = `${Math.round(progress)}%`;
      progressText.textContent = `${Math.round(progress)}%`;
    });
  }
});
