document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element References ---
    const sidebar = document.getElementById('sidebar');
    const menuToggle = document.getElementById('menu-toggle');
    const mainContentArea = document.getElementById('main-content-area');
    const canvas = document.getElementById('canvas');
    const widgetItems = document.querySelectorAll('.widget-item');
   
    // Upload buttons and their hidden file inputs
    const uploadLogoBtn = document.getElementById('upload-logo-btn');
    const logoUploadInput = document.getElementById('logo-upload-input');
    const uploadBackgroundBtn = document.getElementById('upload-background-btn');
    const backgroundUploadInput = document.getElementById('background-upload-input');

    // Dropdown toggles and their content areas
    const logoDropdownToggle = document.getElementById('logo-dropdown-toggle');
    const logoDropdownContent = document.getElementById('logo-dropdown-content');
    const backgroundDropdownToggle = document.getElementById('background-dropdown-toggle');
    const backgroundDropdownContent = document.getElementById('background-dropdown-content');
    const colorButtons = backgroundDropdownContent.querySelectorAll('button[data-color]'); // Predefined color buttons
    const customBgColorInput = document.getElementById('custom-bg-color'); // Custom color picker
    const uploadedBackgroundsList = document.getElementById('uploaded-backgrounds-list'); // Container for uploaded backgrounds
    const removeBgFilterBtn = document.getElementById('remove-bg-filter-btn'); // Button to clear background

    // Action buttons
    const saveScreenBtn = document.getElementById('save-screen-btn');
    const clearScreenBtn = document.getElementById('clear-screen-btn');

    // Tab navigation elements
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    // Modal elements for confirmation/alerts
    const customModal = document.getElementById('custom-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalMessage = document.getElementById('modal-message');
    const modalCancelBtn = document.getElementById('modal-cancel-btn');
    const modalConfirmBtn = document.getElementById('modal-confirm-btn');

    // --- Global State Variables ---
    let activeDragElement = null; // Stores the actual DOM element being dragged/resized
    let isDragging = false; // Flag to indicate if an element is currently being dragged
    let isResizing = false; // Flag to indicate if an element is currently being resized
    let initialMouseX, initialMouseY; // Initial mouse coordinates for drag/resize calculations
    let initialElementX, initialElementY; // Initial position of the element for drag
    let initialElementWidth, initialElementHeight; // Initial dimensions of the element for resize

    let currentActiveWidget = null; // To keep track of the currently selected widget for deletion/highlighting
    let widgetCounter = 0; // Unique ID counter for new widgets
    const uploadedLogos = []; // Array to store data about uploaded logo images { id, src, name }
    const uploadedBackgrounds = []; // Array to store data about uploaded background images { id, src, name }

    // Initialize ResizeObserver for dynamic font sizing (especially for clock and temperature)
    // This watches for changes in element dimensions and calls a callback function.
    const resizeObserver = new ResizeObserver(entries => {
        for (let entry of entries) {
            if (entry.target.dataset.type === 'clock') {
                adjustClockFontSize(entry.target);
            } else if (entry.target.dataset.type === 'temperature') {
                adjustTemperatureDisplaySize(entry.target);
            }
        }
    });

    // --- Utility Functions ---

    /**
     * Displays a custom confirmation modal.
     * @param {string} title - The title of the modal.
     * @param {string} message - The message to display.
     * @returns {Promise<boolean>} - Resolves true if confirmed, false if cancelled.
     */
    function showCustomModal(title, message) {
        return new Promise(resolve => {
            modalTitle.textContent = title;
            modalMessage.textContent = message;
            customModal.classList.remove('hidden'); // Show the modal

            const confirmHandler = () => {
                customModal.classList.add('hidden'); // Hide modal on confirm
                // Remove event listeners to prevent multiple triggers
                modalConfirmBtn.removeEventListener('click', confirmHandler);
                modalCancelBtn.removeEventListener('click', cancelHandler);
                resolve(true); // Resolve the promise with true (confirmed)
            };

            const cancelHandler = () => {
                customModal.classList.add('hidden'); // Hide modal on cancel
                // Remove event listeners
                modalConfirmBtn.removeEventListener('click', confirmHandler);
                modalCancelBtn.removeEventListener('click', cancelHandler);
                resolve(false); // Resolve the promise with false (cancelled)
            };

            modalConfirmBtn.addEventListener('click', confirmHandler);
            modalCancelBtn.addEventListener('click', cancelHandler);
        });
    }

    // --- Sidebar and Menu Toggle Functionality ---

    // Toggles the sidebar visibility and adjusts main content margin
    menuToggle.addEventListener('click', () => {
        sidebar.classList.toggle('open'); // Add/remove 'open' class for animation
        // Adjust main content margin based on sidebar state for better layout
        if (sidebar.classList.contains('open')) {
            mainContentArea.style.marginLeft = '256px'; // Corresponding to w-64
        } else {
            mainContentArea.style.marginLeft = '0'; // Reset margin
        }
    });

    // --- Dropdown Toggles Functionality ---

    // Toggles the visibility of the logo dropdown content
    logoDropdownToggle.addEventListener('click', () => {
        logoDropdownContent.classList.toggle('hidden');
        logoDropdownToggle.querySelector('i').classList.toggle('rotate-180'); // Rotate chevron icon
    });

    // Toggles the visibility of the background dropdown content
    backgroundDropdownToggle.addEventListener('click', () => {
        backgroundDropdownContent.classList.toggle('hidden');
        backgroundDropdownToggle.querySelector('i').classList.toggle('rotate-180'); // Rotate chevron icon
    });

    // --- Background Selection Functionality ---

    // Event listeners for predefined color buttons
    colorButtons.forEach(button => {
        button.addEventListener('click', () => {
            const color = button.dataset.color; // Get color from data attribute
            setCanvasBackground(null, color); // Set canvas background to chosen color, clear any image
        });
    });

    // Event listener for custom color input
    customBgColorInput.addEventListener('input', (e) => {
        setCanvasBackground(null, e.target.value); // Set custom color as background
    });

    // Functionality for the "Remove Background" button
    removeBgFilterBtn.addEventListener('click', () => {
        setCanvasBackground(); // Call without arguments to reset background to default (transparent/none)
    });

    /**
     * Applies an uploaded image or a solid color as the canvas background.
     * If no arguments, resets the background.
     * @param {string} imageUrl - Data URL of the image.
     * @param {string} color - Background color to set (if no image).
     */
    function setCanvasBackground(imageUrl = null, color = null) {
        if (imageUrl) {
            canvas.style.backgroundImage = `url('${imageUrl}')`;
            canvas.style.backgroundSize = 'cover'; // Cover the entire canvas
            canvas.style.backgroundPosition = 'center'; // Center the image
            canvas.style.backgroundRepeat = 'no-repeat'; // Prevent tiling
            canvas.style.backgroundColor = 'transparent'; // Ensure background color doesn't interfere
        } else if (color) {
            canvas.style.backgroundImage = 'none'; // Remove any image background
            canvas.style.backgroundColor = color; // Set solid color
        } else {
            // Reset to default if no image or color provided
            canvas.style.backgroundImage = 'none';
            canvas.style.backgroundColor = ''; // Or set to a default light color like '#ffffff'
        }
    }

    // --- Global Drag & Drop and Resize Handlers (for existing widgets and new ones) ---

    // Handles mouse/touch movement during drag or resize
    function onGlobalMouseMove(e) {
        if (activeDragElement && (isDragging || isResizing)) {
            e.preventDefault(); // Prevent default browser drag behavior (e.g., text selection)

            let clientX = e.clientX;
            let clientY = e.clientY;
            // Adjust for touch events
            if (e.touches && e.touches.length > 0) {
                clientX = e.touches[0].clientX;
                clientY = e.touches[0].clientY;
            }

            if (isDragging) {
                // Calculate new position based on mouse movement
                let newX = clientX - initialMouseX + initialElementX;
                let newY = clientY - initialMouseY + initialElementY;

                // Clamp to canvas boundaries to prevent dragging elements off-screen
                const canvasRect = canvas.getBoundingClientRect();
                const elementRect = activeDragElement.getBoundingClientRect();

                newX = Math.max(0, Math.min(newX, canvasRect.width - elementRect.width));
                newY = Math.max(0, Math.min(newY, canvasRect.height - elementRect.height));

                activeDragElement.style.left = `${newX}px`;
                activeDragElement.style.top = `${newY}px`;
            } else if (isResizing) {
                // Calculate new width and height based on mouse movement
                // Minimum size of 50px for all widgets
                let newWidth = Math.max(50, initialElementWidth + (clientX - initialMouseX));
                let newHeight = Math.max(50, initialElementHeight + (clientY - initialMouseY));

                activeDragElement.style.width = `${newWidth}px`;
                activeDragElement.style.height = `${newHeight}px`;

                // Adjust content inside widget if applicable (e.g., image, textarea, line)
                const img = activeDragElement.querySelector('img');
                if (img) {
                    img.style.width = '100%';
                    img.style.height = '100%';
                    img.style.objectFit = 'contain'; // Ensure image scales correctly
                }
                const textarea = activeDragElement.querySelector('textarea');
                if (textarea) {
                    textarea.style.width = '100%';
                    textarea.style.height = '100%';
                }
                const lineContent = activeDragElement.querySelector('.widget-line-content');
                if (lineContent) {
                    lineContent.style.width = '100%';
                    lineContent.style.height = '100%';
                }
            }
        }
    }

    // Handles mouse/touch release after drag or resize
    function onGlobalMouseUp() {
        // Remove global event listeners
        document.removeEventListener('mousemove', onGlobalMouseMove);
        document.removeEventListener('touchmove', onGlobalMouseMove);
        document.removeEventListener('mouseup', onGlobalMouseUp);
        document.removeEventListener('touchend', onGlobalMouseUp);

        if (isDragging) {
            // Logic for dropping a new widget from the sidebar onto the canvas
            if (activeDragElement.dataset.fromSidebar === 'true') {
                const canvasRect = canvas.getBoundingClientRect();
                const elementRect = activeDragElement.getBoundingClientRect();

                // Check if widget is dropped within the canvas boundaries
                if (elementRect.left >= canvasRect.left &&
                    elementRect.right <= canvasRect.right &&
                    elementRect.top >= canvasRect.top &&
                    elementRect.bottom <= canvasRect.bottom) {

                    // Adjust position relative to the canvas's top-left corner
                    activeDragElement.style.left = `${activeDragElement.offsetLeft - canvasRect.left}px`;
                    activeDragElement.style.top = `${activeDragElement.offsetTop - canvasRect.top}px`;
                    canvas.appendChild(activeDragElement); // Move element from body to canvas
                    activeDragElement.style.opacity = '1'; // Reset opacity
                    delete activeDragElement.dataset.fromSidebar; // Remove flag
                } else {
                    activeDragElement.remove(); // Remove widget if dropped outside canvas
                }
            }
        }
       
        // Hide controls (trash, resize, rotate) if the element is no longer the active selected widget
        if (activeDragElement && activeDragElement !== currentActiveWidget) {
            activeDragElement.querySelector('.fa-trash-alt')?.classList.add('hidden');
            activeDragElement.querySelector('.widget-handle')?.classList.add('hidden');
            if (activeDragElement.dataset.type === 'line') {
                activeDragElement.querySelector('.fa-sync-alt')?.classList.add('hidden');
            }
        }

        // Reset drag/resize flags and active element
        isDragging = false;
        isResizing = false;
        activeDragElement = null;
    }


    /**
     * Makes an element draggable and resizable within its parent.
     * Adds trash and resize handle icons. For 'line' widgets, adds a rotate icon.
     * @param {HTMLElement} element - The element to make draggable/resizable.
     */
    function makeDraggableAndResizable(element) {
        // Create and append trash icon
        const trashIcon = document.createElement('i');
        trashIcon.className = 'fas fa-trash-alt absolute top-2 right-2 text-red-500 cursor-pointer hidden p-1 bg-white rounded-full shadow-md z-20';
        element.appendChild(trashIcon);

        // Create and append resize handle
        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'widget-handle hidden';
        element.appendChild(resizeHandle);

        let rotateIcon = null; // Initialize rotateIcon as null
        // Add rotate icon specifically for line widgets
        if (element.dataset.type === 'line') {
            rotateIcon = document.createElement('i');
            rotateIcon.className = 'fas fa-sync-alt absolute top-2 left-2 text-blue-500 cursor-pointer hidden p-1 bg-white rounded-full shadow-md z-20';
            element.appendChild(rotateIcon);

            // Rotate functionality for the line widget
            rotateIcon.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent drag/resize from starting on icon click
                let currentRotation = parseFloat(element.dataset.rotation || 0); // Get current rotation
                currentRotation = (currentRotation + 90) % 360; // Rotate by 90 degrees
                element.style.transform = `rotate(${currentRotation}deg)`; // Apply rotation
                element.dataset.rotation = currentRotation; // Store new rotation
            });
        }

        // Show/hide controls (trash, resize, rotate) on mouse enter/leave
        element.addEventListener('mouseenter', () => {
            trashIcon.classList.remove('hidden');
            resizeHandle.classList.remove('hidden');
            if (rotateIcon) rotateIcon.classList.remove('hidden'); // Show rotate icon if it exists
        });
        element.addEventListener('mouseleave', () => {
            // Only hide if not currently dragging/resizing AND not the active selected widget
            if (!isDragging && !isResizing && element !== currentActiveWidget) {
                trashIcon.classList.add('hidden');
                resizeHandle.classList.add('hidden');
                if (rotateIcon) rotateIcon.classList.add('hidden'); // Hide rotate icon
            }
        });

        // Event listener for starting drag/resize on the widget
        element.addEventListener('mousedown', (e) => {
            // Prevent drag/resize if click is on textarea, trash icon, or rotate icon
            if (e.target.tagName === 'TEXTAREA' || e.target.closest('.widget-text-content') || e.target === trashIcon || e.target === rotateIcon) {
                // For textarea, allow default behavior. For icons, handle their click, not drag.
                // However, still set as active widget.
            } else {
                e.stopPropagation(); // Prevent canvas from getting the click if clicking on the widget's "body"
            }
           
            // Highlight the clicked widget and de-highlight any previously active widget
            if (currentActiveWidget && currentActiveWidget !== element) {
                currentActiveWidget.classList.remove('ring-2', 'ring-blue-500', 'active-widget'); // Remove highlight
                currentActiveWidget.querySelector('.fa-trash-alt')?.classList.add('hidden'); // Hide controls
                currentActiveWidget.querySelector('.widget-handle')?.classList.add('hidden');
                if (currentActiveWidget.dataset.type === 'line') {
                    currentActiveWidget.querySelector('.fa-sync-alt')?.classList.add('hidden');
                }
            }
            currentActiveWidget = element; // Set the clicked element as the active widget
            element.classList.add('ring-2', 'ring-blue-500', 'active-widget'); // Add highlight
            trashIcon.classList.remove('hidden'); // Ensure trash is visible when active
            resizeHandle.classList.remove('hidden'); // Ensure handle is visible when active
            if (rotateIcon) rotateIcon.classList.remove('hidden'); // Ensure rotate is visible for line

            // Initialize drag/resize operation if not clicking on controls/textarea
            if (e.target !== trashIcon && e.target !== rotateIcon && e.target.tagName !== 'TEXTAREA' && !e.target.closest('.widget-text-content')) {
                activeDragElement = element;
                initialElementX = element.offsetLeft;
                initialElementY = element.offsetTop;
                initialMouseX = e.clientX || e.touches[0].clientX;
                initialMouseY = e.clientY || e.touches[0].clientY;
                initialElementWidth = element.offsetWidth;
                initialElementHeight = element.offsetHeight;

                if (e.target === resizeHandle) {
                    isResizing = true;
                } else {
                    isDragging = true;
                }

                // Add global mouse/touch event listeners for dragging/resizing
                document.addEventListener('mousemove', onGlobalMouseMove);
                document.addEventListener('touchmove', onGlobalMouseMove, { passive: false });
                document.addEventListener('mouseup', onGlobalMouseUp);
                document.addEventListener('touchend', onGlobalMouseUp);

                e.preventDefault(); // Prevent default browser drag behavior
            }
        });

        // Delete widget on trash icon click
        trashIcon.addEventListener('click', async (e) => {
            e.stopPropagation(); // Prevent triggering widget's mousedown
            const confirmed = await showCustomModal('Delete Widget', 'Are you sure you want to delete this widget?');
            if (confirmed) {
                element.remove(); // Remove the widget from the DOM
                if (currentActiveWidget === element) {
                    currentActiveWidget = null; // Clear active widget reference
                }
            }
        });
    }

    /**
     * Creates a new widget DOM element based on type and initial content.
     * Applies default styles and makes it draggable/resizable.
     * @param {string} type - The type of widget (e.g., 'clock', 'text', 'image', 'weather', 'temperature', 'line', 'edit').
     * @param {string} content - The initial content for the widget (e.g., image URL, text).
     * @returns {HTMLElement} The created widget element.
     */
    function createWidgetElement(type, content = '') {
        const widget = document.createElement('div');
        widget.id = `widget-${widgetCounter++}`; // Assign a unique ID
        widget.className = 'draggable absolute p-3 bg-white rounded-lg shadow-xl border border-gray-200 flex flex-col items-center justify-center';
        widget.dataset.type = type; // Store widget type as a data attribute

        switch (type) {
            case 'clock':
                widget.style.width = '128px'; // Default width
                widget.style.height = '80px';  // Default height
                widget.innerHTML = `<span class="font-bold text-gray-800" id="clock-display-${widget.id}"></span>`;
                // Update clock time every second
                setInterval(() => {
                    const clockElement = document.getElementById(`clock-display-${widget.id}`);
                    if (clockElement) {
                        // Display time for Phoenix, Arizona (MST)
                        clockElement.textContent = new Date().toLocaleTimeString('en-US', { timeZone: 'America/Phoenix' });
                    }
                }, 1000);
                resizeObserver.observe(widget); // Observe for resizing to adjust font size
                break;
            case 'text':
                widget.style.width = '192px'; // Default width
                widget.style.height = '96px';  // Default height
                widget.classList.add('p-2'); // Add padding specific to text
                widget.innerHTML = `<textarea class="widget-text-content w-full h-full p-1 border border-gray-300 rounded-md resize-none text-gray-700" placeholder="Type here..."></textarea>`;
                break;
            case 'line':
                // Line widgets don't need flex centering
                widget.classList.remove('flex', 'flex-col', 'items-center', 'justify-center');
                widget.style.width = '160px'; // Default width
                widget.style.height = '16px'; // Default height (thickness)
                widget.style.minWidth = '20px'; // Minimum size for line
                widget.style.minHeight = '4px'; // Minimum size for line
                widget.style.backgroundColor = '#4a5568'; // Default line color
                widget.innerHTML = `<div class="widget-line-content"></div>`; // Inner div for styling and rotation
                widget.style.transform = 'rotate(0deg)'; // Initial rotation
                widget.dataset.rotation = '0'; // Store initial rotation
                break;
            case 'weather':
                widget.style.width = '224px'; // Increased size for better fit
                widget.style.height = '144px'; // Increased size for better fit
                widget.classList.add('p-4'); // Increased padding
                widget.innerHTML = `
                    <div class="flex flex-col items-center justify-center h-full">
                        <i class="fas fa-cloud-sun text-6xl text-yellow-500 mb-2"></i>
                        <span class="text-xl font-semibold text-gray-800 text-center leading-tight" id="weather-condition-${widget.id}">Loading weather...</span>
                        <span class="text-lg text-gray-600 mt-1" id="weather-temp-${widget.id}"></span>
                        <span class="text-md text-gray-500 mt-1" id="weather-location-${widget.id}">Phoenix, AZ</span>
                    </div>
                `;
                fetchWeatherData(widget.id, 'Phoenix', 'AZ'); // Fetch weather data for Phoenix, AZ
                break;
            case 'temperature':
                widget.style.width = '128px'; // Default width
                widget.style.height = '80px';  // Default height
                widget.classList.add('flex-col'); // Use flex-col for stacked content
                widget.innerHTML = `
                    <i class="fas fa-thermometer-half text-4xl text-red-500" id="temp-icon-${widget.id}"></i>
                    <span class="font-bold text-gray-800 text-center leading-tight" id="temp-value-${widget.id}">Fetching temp...</span>
                    <span class="text-sm text-gray-500 mt-1" id="temp-location-${widget.id}">Phoenix, AZ</span>
                `;
                resizeObserver.observe(widget); // Observe for resizing
                // Simulate API call delay for temperature data
                setTimeout(() => {
                    const tempValueElement = document.getElementById(`temp-value-${widget.id}`);
                    if (tempValueElement) {
                        tempValueElement.textContent = `85°F`; // Static value for now
                        adjustTemperatureDisplaySize(widget); // Call initially after content is set
                    }
                }, 2000); // Simulate 2-second delay
                break;
            case 'image': // This type is now specifically for logos dragged from "Choose Logo"
                widget.style.width = '192px'; // Default width for image
                widget.style.height = '192px'; // Default height for image
                widget.classList.add('overflow-hidden'); // Hide overflowing parts of the image
                widget.innerHTML = `<img src="${content}" alt="Uploaded Image" class="w-full h-full object-contain rounded-md">`;
                break;
            case 'edit': // New widget type (pencil icon) - currently a placeholder
                widget.style.width = '160px'; // Default width
                widget.style.height = '160px'; // Default height
                widget.classList.add('flex-col'); // Use flex-col for stacked content
                widget.innerHTML = `
                    <i class="fas fa-pencil-ruler text-4xl text-blue-500 mb-2"></i>
                    <span class="text-lg font-semibold text-gray-800">Edit Tool</span>
                    <span class="text-sm text-gray-600">(Placeholder)</span>
                `;
                break;
            case 'log': // Logs are not directly draggable as widgets anymore; they're in the dropdown.
                // This case might not be strictly needed if logs are only read and not placed as separate widgets.
                // However, if the user might want to drag a "log text box", this remains for future flexibility.
                widget.style.width = '256px'; // Default width for log
                widget.style.height = '192px'; // Default height for log
                widget.classList.add('p-2', 'overflow-auto'); // Add padding and allow scrolling
                widget.innerHTML = `<pre class="text-xs text-gray-800 whitespace-pre-wrap">${content}</pre>`;
                break;
        }
        makeDraggableAndResizable(widget); // Make the new widget draggable and resizable
        return widget;
    }

    // Function to adjust clock font size dynamically based on widget size
    function adjustClockFontSize(clockWidgetElement) {
        const clockDisplay = clockWidgetElement.querySelector(`#clock-display-${clockWidgetElement.id}`);
        if (!clockDisplay) return;

        // Subtract padding from available width/height
        const paddingX = parseInt(getComputedStyle(clockWidgetElement).paddingLeft) + parseInt(getComputedStyle(clockWidgetElement).paddingRight);
        const paddingY = parseInt(getComputedStyle(clockWidgetElement).paddingTop) + parseInt(getComputedStyle(clockWidgetElement).paddingBottom);

        const maxWidth = clockWidgetElement.offsetWidth - paddingX;
        const maxHeight = clockWidgetElement.offsetHeight - paddingY;

        // Start with a large font size and reduce until it fits
        let fontSize = 48; // Max initial font size
        clockDisplay.style.fontSize = `${fontSize}px`;
        clockDisplay.style.whiteSpace = 'nowrap'; // Prevent wrapping

        // Reduce font size until text fits within the available width and height
        while ((clockDisplay.scrollWidth > maxWidth || clockDisplay.scrollHeight > maxHeight) && fontSize > 8) {
            fontSize--;
            clockDisplay.style.fontSize = `${fontSize}px`;
        }
        // Add minimum font size to prevent text from disappearing
        if (fontSize <= 8) {
            clockDisplay.style.fontSize = '8px';
        }
    }

    // Function to adjust temperature widget font and icon size dynamically
    function adjustTemperatureDisplaySize(tempWidgetElement) {
        const tempIcon = tempWidgetElement.querySelector(`#temp-icon-${tempWidgetElement.id}`);
        const tempValue = tempWidgetElement.querySelector(`#temp-value-${tempWidgetElement.id}`);
        const tempLocation = tempWidgetElement.querySelector(`#temp-location-${tempWidgetElement.id}`);

        if (!tempIcon || !tempValue || !tempLocation) return;

        // Get current widget dimensions including padding
        const widgetWidth = tempWidgetElement.offsetWidth;
        const widgetHeight = tempWidgetElement.offsetHeight;
        const paddingX = parseInt(getComputedStyle(tempWidgetElement).paddingLeft) + parseInt(getComputedStyle(tempWidgetElement).paddingRight);
        const paddingY = parseInt(getComputedStyle(tempWidgetElement).paddingTop) + parseInt(getComputedStyle(tempWidgetElement).paddingBottom);

        const availableWidth = widgetWidth - paddingX;
        const availableHeight = widgetHeight - paddingY;

        // Calculate ideal sizes for icon, value, and location based on available height
        // These ratios can be tweaked for better visual balance
        let idealIconSize = availableHeight * 0.4; // Icon takes up about 40% of height
        let idealValueSize = availableHeight * 0.3; // Value takes about 30%
        let idealLocationSize = availableHeight * 0.2; // Location takes about 20%

        // Clamp to reasonable min/max values to prevent extreme scaling
        tempIcon.style.fontSize = `${Math.max(20, Math.min(60, idealIconSize))}px`;
        tempValue.style.fontSize = `${Math.max(12, Math.min(48, idealValueSize))}px`;
        tempLocation.style.fontSize = `${Math.max(10, Math.min(20, idealLocationSize))}px`;

        // Use flex-shrink and text-overflow properties for better responsiveness within flex container
        tempValue.style.flexShrink = '1';
        tempLocation.style.flexShrink = '1';
        tempValue.style.whiteSpace = 'nowrap';
        tempLocation.style.whiteSpace = 'nowrap';
        tempValue.style.overflow = 'hidden';
        tempLocation.style.overflow = 'hidden';
        tempValue.style.textOverflow = 'ellipsis';
        tempLocation.style.textOverflow = 'ellipsis';
    }

    // Function to simulate fetching weather data using a dummy API call
    async function fetchWeatherData(widgetId, city, state) {
        const weatherConditionElement = document.getElementById(`weather-condition-${widgetId}`);
        const weatherTempElement = document.getElementById(`weather-temp-${widgetId}`);
        const weatherLocationElement = document.getElementById(`weather-location-${widgetId}`);

        // Indicate loading state to the user
        if (weatherConditionElement) weatherConditionElement.textContent = "Loading weather...";
        if (weatherTempElement) weatherTempElement.textContent = "";

        // Dummy API call simulation using Gemini API. Note: Replace with actual weather API if available.
        const dummyApiKey = ""; // This will be automatically provided by the platform if running in a Google environment.
        const dummyApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${dummyApiKey}`;

        // Prepare chat history for the dummy API request
        let chatHistory = [{
            role: "user",
            parts: [{ text: `Generate a current weather condition and temperature for ${city}, ${state}. Provide a concise condition (e.g., "Sunny", "Partly Cloudy", "Rain"), followed by the temperature in Fahrenheit and Celsius (e.g., "78°F / 25°C"). Respond only with this format, e.g., "Sunny, 78°F / 25°C"` }]
        }];

        try {
            const response = await fetch(dummyApiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: chatHistory })
            });
            const result = await response.json();

            // Parse and display the generated weather data
            if (result.candidates && result.candidates.length > 0 &&
                result.candidates[0].content && result.candidates[0].content.parts &&
                result.candidates[0].content.parts.length > 0) {
                const generatedText = result.candidates[0].content.parts[0].text;
                const parts = generatedText.split(',');
                const condition = parts[0] ? parts[0].trim() : "N/A";
                const temp = parts[1] ? parts[1].trim() : "N/A";

                if (weatherConditionElement) weatherConditionElement.textContent = condition;
                if (weatherTempElement) weatherTempElement.textContent = temp;
                if (weatherLocationElement) weatherLocationElement.textContent = `${city}, ${state}`;
            } else {
                console.error('Unexpected API response structure:', result);
                if (weatherConditionElement) weatherConditionElement.textContent = "Weather N/A";
                if (weatherTempElement) weatherTempElement.textContent = "N/A";
                if (weatherLocationElement) weatherLocationElement.textContent = `${city}, ${state}`;
            }
        } catch (error) {
            console.error('Error fetching weather data:', error);
            if (weatherConditionElement) weatherConditionElement.textContent = "Error";
            if (weatherTempElement) weatherTempElement.textContent = "N/A";
            if (weatherLocationElement) weatherLocationElement.textContent = `${city}, ${state}`;
        }
    }


    // --- Event Listeners for Sidebar Widget Items (for starting a new drag) ---
    widgetItems.forEach(item => {
        item.addEventListener('mousedown', (e) => {
            // Do not drag if the click is on the file input buttons or "Edit" (which is a placeholder, not for drag-to-canvas)
            if (e.target.closest('#upload-logo-btn') || e.target.closest('#upload-background-btn') || item.id === 'widget-edit') return;

            const type = item.id.replace('widget-', ''); // Extract widget type from ID (e.g., 'text', 'clock')
            const newWidget = createWidgetElement(type); // Create a new widget element
            newWidget.style.opacity = '0.7'; // Visual feedback for dragging
            newWidget.style.zIndex = '1000'; // Bring to front during drag
            newWidget.dataset.fromSidebar = 'true'; // Flag to indicate it originated from the sidebar

            document.body.appendChild(newWidget); // Temporarily append to body for dragging across screen

            // Initialize drag variables
            activeDragElement = newWidget;
            initialElementX = newWidget.offsetLeft;
            initialElementY = newWidget.offsetTop;
            initialMouseX = e.clientX || e.touches[0].clientX;
            initialMouseY = e.clientY || e.touches[0].clientY;
            initialElementWidth = newWidget.offsetWidth;
            initialElementHeight = newWidget.offsetHeight;
            isDragging = true; // Set drag flag

            // Add global event listeners for tracking mouse/touch movement and release
            document.addEventListener('mousemove', onGlobalMouseMove);
            document.addEventListener('touchmove', onGlobalMouseMove, { passive: false });
            document.addEventListener('mouseup', onGlobalMouseUp);
            document.addEventListener('touchend', onGlobalMouseUp);

            e.preventDefault(); // Prevent default browser drag behavior
        });
    });

    // --- Handle Logo Upload ---
    uploadLogoBtn.addEventListener('click', () => {
        logoUploadInput.click(); // Trigger click on hidden file input
    });

    logoUploadInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file || !file.type.startsWith('image/')) {
            showCustomModal('Invalid File', 'Please upload an image file for the logo.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const id = `logo-${Date.now()}`; // Unique ID for the logo
            uploadedLogos.push({ id, src: e.target.result, name: file.name }); // Store logo data
            addLogoToDropdown(id, e.target.result, file.name); // Add to dropdown
        };
        reader.readAsDataURL(file); // Read file as Data URL
    });

    /**
     * Adds an uploaded logo to the "Choose Logo" dropdown.
     * @param {string} id - Unique ID of the logo.
     * @param {string} src - Data URL of the logo image.
     * @param {string} name - File name.
     */
    function addLogoToDropdown(id, src, name) {
        const placeholder = logoDropdownContent.querySelector('p');
        if (placeholder) placeholder.remove(); // Remove "No logos uploaded yet." message

        const logoItem = document.createElement('div');
        logoItem.className = 'sidebar-dropdown-item';
        logoItem.dataset.id = id;
        logoItem.innerHTML = `<img src="${src}" alt="${name}" class="w-8 h-8 object-contain rounded-md mr-2"> <span class="text-sm truncate flex-1">${name}</span>`;

        // When a logo item in the dropdown is clicked, create a new image widget on canvas
        logoItem.addEventListener('click', () => {
            const newWidget = createWidgetElement('image', src); // Reusing 'image' type for logos on canvas
            canvas.appendChild(newWidget);
            // Center logo for initial placement
            newWidget.style.left = `${(canvas.offsetWidth - newWidget.offsetWidth) / 2}px`;
            newWidget.style.top = `${(canvas.offsetHeight - newWidget.offsetHeight) / 2}px`;
        });
        logoDropdownContent.appendChild(logoItem);
    }

    // --- Handle Background Upload ---
    uploadBackgroundBtn.addEventListener('click', () => {
        backgroundUploadInput.click(); // Trigger click on hidden file input
    });

    backgroundUploadInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file || !file.type.startsWith('image/')) {
            showCustomModal('Invalid File', 'Please upload an image file for the background.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const id = `bg-${Date.now()}`; // Unique ID for the background
            uploadedBackgrounds.push({ id, src: e.target.result, name: file.name }); // Store background data
            addBackgroundToDropdown(id, e.target.result, file.name); // Add to dropdown
            setCanvasBackground(e.target.result); // Automatically apply as background
        };
        reader.readAsDataURL(file); // Read file as Data URL
    });

    /**
     * Adds an uploaded background image to the "Choose Background" dropdown.
     * @param {string} id - Unique ID of the background.
     * @param {string} src - Data URL of the background image.
     * @param {string} name - File name.
     */
    function addBackgroundToDropdown(id, src, name) {
        const placeholder = uploadedBackgroundsList.querySelector('p');
        if (placeholder) placeholder.remove(); // Remove "No backgrounds uploaded yet." message

        const bgItem = document.createElement('div');
        bgItem.className = 'sidebar-dropdown-item';
        bgItem.dataset.id = id;
        bgItem.innerHTML = `<img src="${src}" alt="${name}" class="w-8 h-8 object-cover rounded-md mr-2"> <span class="text-sm truncate flex-1">${name}</span>`;

        // When a background item in the dropdown is clicked, apply it to the canvas
        bgItem.addEventListener('click', () => {
            setCanvasBackground(src);
        });
        uploadedBackgroundsList.appendChild(bgItem);
    }


    // --- Canvas Interaction (Clicking outside widget deselects) ---
    canvas.addEventListener('mousedown', (e) => {
        // If click is on canvas itself and not on a widget, deselect current active widget
        if (currentActiveWidget && !e.target.closest('.draggable')) {
            currentActiveWidget.classList.remove('ring-2', 'ring-blue-500', 'active-widget'); // Remove highlight
            currentActiveWidget.querySelector('.fa-trash-alt')?.classList.add('hidden'); // Hide controls
            currentActiveWidget.querySelector('.widget-handle')?.classList.add('hidden');
            if (currentActiveWidget.dataset.type === 'line') {
                currentActiveWidget.querySelector('.fa-sync-alt')?.classList.add('hidden');
            }
            currentActiveWidget = null; // Clear active widget reference
        }
    });

    // --- Action Buttons Functionality ---

    // Save Screen Button
    saveScreenBtn.addEventListener('click', async () => {
        const confirmed = await showCustomModal('Save Preset', 'This will save the current layout as a preset. (Functionality is a placeholder)');
        if (confirmed) {
            // In a real application, you would serialize the canvas state (widget types, positions, content)
            // and save it to local storage, a database, or send to a server.
            console.log('Save Screen: Functionality to be implemented');
            showCustomModal('Preset Saved!', 'Your current workspace layout has been saved as a preset.');
        }
    });

    // Clear Screen Button
    clearScreenBtn.addEventListener('click', async () => {
        const confirmed = await showCustomModal('Clear Canvas', 'Are you sure you want to clear all widgets from the canvas? This action cannot be undone.');
        if (confirmed) {
            canvas.innerHTML = ''; // Remove all child elements (widgets) from the canvas
            setCanvasBackground(); // Reset background to default (no image, no color)
            widgetCounter = 0; // Reset widget counter for fresh IDs
            uploadedLogos.length = 0; // Clear stored logos
            logoDropdownContent.innerHTML = '<p class="text-sm text-gray-300">No logos uploaded yet.</p>'; // Reset logo dropdown
            uploadedBackgrounds.length = 0; // Clear stored backgrounds
            uploadedBackgroundsList.innerHTML = '<p class="text-sm text-gray-300">No backgrounds uploaded yet.</p>'; // Reset background dropdown
            currentActiveWidget = null; // Clear active widget reference
            showCustomModal('Canvas Cleared!', 'All widgets have been removed from the canvas.');
        }
    });

    // --- Tab Switching Logic ---

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove active state from all tab buttons and content
            tabButtons.forEach(btn => {
                btn.classList.remove('bg-white', 'shadow', 'text-blue-800');
                btn.classList.add('text-white', 'hover:bg-blue-700');
            });
            tabContents.forEach(content => content.classList.remove('active'));

            // Add active state to the clicked button and its corresponding content
            button.classList.add('bg-white', 'shadow', 'text-blue-800');
            button.classList.remove('text-white', 'hover:bg-blue-700');

            // Determine which tab content to show based on the button's ID
            const targetTabId = button.id.replace('tab-', '') + '-tab-content';
            document.getElementById(targetTabId).classList.add('active');
        });
    });

    // --- Initial Setup on Page Load ---
    document.getElementById('tab-workspace').click(); // Activate the workspace tab by default
    menuToggle.click(); // Open the sidebar initially for better discoverability
});
