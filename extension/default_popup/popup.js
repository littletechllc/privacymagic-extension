document.getElementById('settingsButton').addEventListener('click', function() {
    console.log('settingsButton clicked');
    chrome.runtime.openOptionsPage();
});

