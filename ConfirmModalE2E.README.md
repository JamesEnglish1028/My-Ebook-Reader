# ConfirmModal E2E Accessibility Notebook Instructions

This document explains how to run the ConfirmModal E2E accessibility test notebook for this project.

## Prerequisites
- Node.js and npm installed
- Python 3.x installed
- Jupyter or VS Code with Jupyter extension
- The app running locally (e.g., `npm run dev`)

## Steps

1. **Start the App**
   - In your project directory, run:
     ```sh
     npm run dev
     ```
   - Ensure the app is accessible at `http://localhost:3000` (or update the notebook if using a different port).

2. **Open the Notebook**
   - Open `docs/experiments/e2e-notebooks/ConfirmModalE2E.ipynb` in Jupyter or VS Code.

3. **Install Playwright**
   - Run the first code cell to install Playwright and its browsers:
     ```python
     !pip install playwright
     !playwright install
     ```

4. **Run the E2E Test**
   - Run the notebook cells in order. The test will:
     - Open the app
     - Trigger the ConfirmModal (ensure a button with `data-testid="open-confirm-modal"` exists)
     - Check ARIA roles and tab order for Cancel, Confirm, and Close buttons
   - The output will indicate if the accessibility checks pass.

5. **Troubleshooting**
   - If the test cannot find the modal trigger, add a test button to your app:
     ```jsx
     <button data-testid="open-confirm-modal" onClick={() => setModalOpen(true)}>Open ConfirmModal</button>
     ```
   - Adjust the notebook's `APP_URL` if your app runs on a different port or path.

## Next Steps
- After verifying ConfirmModal accessibility, proceed to the next accessibility or E2E test task as outlined in your project plan or todo list.
