document.addEventListener('DOMContentLoaded', function() {
    const modeToggle = document.getElementById('light-toggle');
    if (!modeToggle) {
        return;
    }

    updateThemeToggle(modeToggle);

    modeToggle.addEventListener('click', function() {
        toggleTheme();
        updateThemeToggle(modeToggle);
    });
});

