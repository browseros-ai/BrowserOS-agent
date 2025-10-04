// Apply saved theme immediately to prevent flash
(function() {
  const savedTheme = localStorage.getItem('browseros-theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  if (savedTheme === 'dark' || savedTheme === 'gray') {
    document.documentElement.classList.add(savedTheme);
  }
})();