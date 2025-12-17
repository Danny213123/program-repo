import './Footer.css';

export function Footer() {
    return (
        <footer className="rocm-footer">
            <div className="container-lg">
                <section className="bottom-menu menu py-45">
                    <div className="row d-flex align-items-center">
                        <div className="col-12 text-center">
                            <ul>
                                <li><a href="https://www.amd.com/en/corporate/copyright" target="_blank" rel="noopener noreferrer">Terms and Conditions</a></li>
                                <li><a href="https://www.amd.com/en/corporate/privacy" target="_blank" rel="noopener noreferrer">Privacy</a></li>
                                <li><a href="https://www.amd.com/en/corporate/trademarks" target="_blank" rel="noopener noreferrer">Trademarks</a></li>
                                <li><a href="https://www.amd.com/content/dam/amd/en/documents/corporate/cr/supply-chain-transparency.pdf" target="_blank" rel="noopener noreferrer">Supply Chain Transparency</a></li>
                                <li><a href="https://www.amd.com/en/corporate/competition" target="_blank" rel="noopener noreferrer">Fair and Open Competition</a></li>
                                <li><a href="https://www.amd.com/system/files/documents/amd-uk-tax-strategy.pdf" target="_blank" rel="noopener noreferrer">UK Tax Strategy</a></li>
                                <li><a href="https://www.amd.com/en/corporate/cookies" target="_blank" rel="noopener noreferrer">Cookie Policy</a></li>
                                <li><a href="#cookie-settings" id="ot-sdk-btn" className="ot-sdk-show-settings">Cookie Settings</a></li>
                            </ul>
                        </div>
                    </div>
                    <div className="row d-flex align-items-center">
                        <div className="col-12 text-center">
                            <div>
                                <span className="copyright">© 2025 Advanced Micro Devices, Inc</span>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </footer>
    );
}
