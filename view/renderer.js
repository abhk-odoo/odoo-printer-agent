window.addEventListener("DOMContentLoaded", async () => {
  const ip = await window.api.getIPAddress();
  document.getElementById("ip").textContent = `IP: ${ip}`;

  const printerListContainer = document.getElementById("printerList");
  const noPrintersMessage = document.getElementById("noPrinters");

  const printers = await window.api.getUSBPrinters();
  printerListContainer.innerHTML = "";

  if (printers.length === 0) {
    noPrintersMessage.textContent = "No connected USB printers found.";
  } else {
    noPrintersMessage.style.display = "none";
    printers.forEach((printer, index) => {
      const card = document.createElement("div");
      card.className = "printer-card";
      card.innerHTML = `
        <h3>Printer ${index + 1}</h3>
        <p><strong>Vendor ID:</strong> ${printer.vendorId}</p>
        <p><strong>Product ID:</strong> ${printer.productId}</p>
        <p><strong>Manufacturer:</strong> ${printer.manufacturer}</p>
        <p><strong>Product:</strong> ${printer.product}</p>
      `;
      printerListContainer.appendChild(card);
    });
  }

  const connectBtn = document.getElementById("connectBtn");
  const disconnectBtn = document.getElementById("disconnectBtn");

  const isRunning = await window.api.isServerRunning?.(); // Optional: Check server status

  if (isRunning) {
    connectBtn.style.display = "none";
    disconnectBtn.style.display = "inline-block";
  } else {
    connectBtn.style.display = "inline-block";
    disconnectBtn.style.display = "none";
  }

  connectBtn.onclick = async () => {
    connectBtn.disabled = true;

    try {
      await window.api.startServer();
      connectBtn.style.display = "none";
      disconnectBtn.style.display = "inline-block";
    } catch (error) {
      console.error("Failed to start server:", error);
    } finally {
      connectBtn.disabled = false;
    }
  };

  disconnectBtn.onclick = async () => {
    disconnectBtn.disabled = true;

    try {
      await window.api.stopServer();
      disconnectBtn.style.display = "none";
      connectBtn.style.display = "inline-block";
    } catch (error) {
      console.error("Failed to stop server:", error);
    } finally {
      disconnectBtn.disabled = false;
    }
  };
});
