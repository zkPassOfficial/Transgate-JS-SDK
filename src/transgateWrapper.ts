export const transgateWrapper = `<div>
      <style>
        #zkpass-modal-wrapper {
          display: block;
          width: 380px;
          height: 600px;
          background-color: #ffffff;
          padding: 24px;
          border-radius: 15px;
          font-family: Arial, Helvetica, sans-serif;
          color: #1e2329;
        }
        #modal-header {
          display: flex;
          justify-content: space-between;
          p {
            font-size: 22px;
            font-weight: 400;
            margin: 0px;
          }
          .close-icon {
            position: relative;
            width: 20px;
            height: 20px;
            cursor: pointer;
          }

          .close-icon::before,
          .close-icon::after {
            content: "";
            position: absolute;
            width: 2px;
            height: 20px;
            background-color: #9d9d9d;
            left: 9px;
            top: 0;
          }

          .close-icon::before {
            transform: rotate(45deg);
          }

          .close-icon::after {
            transform: rotate(-45deg);
          }
        }
        #modal-body {
          margin: 36px auto 24px;
          position: relative;
          width: 240px;
          #zkpass-canvas {
            width: 240px;
            height: 240px;
            background-color: #f0f0f0;
          }
          #zkPass-logo {
            position: absolute;
            top: 120px;
            left: 50%;
            width: 48px;
            height: 48px;
            transform: translate(-50%, -50%);
            z-index: 99;
            border-radius: 8px;
            border: 3px solid #ffffff;
            overflow: hidden;
            svg {              
              width: 100%;
              height: 100%;
            }
          }
          p {
            font-size: 14px;
            color: #2c333c;
            margin-bottom: 0;
            margin-top: 8px;
            padding-left: 12px;
          }
        }
        #modal-footer {
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          width: 316px;
          border-top: 1px solid #eaeef3;
          padding-top: 16px;
          color: #9d9d9d;
          margin: auto;
          .tips {
            font-size: 14px;
          }
          .download-btn {
            display: grid;
            grid-template-columns: auto auto;
            gap: 16px;
            color: #9d9d9d;
            font-size: 12px;
            padding: 12px;
            box-sizing: border-box;
            border-radius: 8px;
            cursor: pointer;
          }
          .download-btn a{
            display: grid;
            grid-gap: 16px;
            grid-auto-flow: column;
          }
          .grid {
            margin-top: 12px;
            display: grid;
            grid-template-columns: 150px 150px;
            gap: 16px;
          }
        }
      </style>
      <div id="zkpass-modal-wrapper">
        <div id="modal">
          <div id="modal-header">
            <p>Verify by TransGate App</p>
            <div id="close-transgate" class="close-icon"></div>
          </div>
          <div id="modal-body">
            <canvas id="zkpass-canvas" with="240" height="240"></canvas>
            <div id="zkPass-logo">
              <svg width="1091" height="1091" viewBox="0 0 1091 1091" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="1" y="1" width="1089" height="1089" fill="#C5FF4A" stroke="#3D3D3D"/>
              <path fill-rule="evenodd" clip-rule="evenodd" d="M685.58 312.143H405.418V405.419H685.414V498.696H778.69V405.419C778.69 353.784 736.882 312.143 685.414 312.143H685.58Z" fill="black"/>
              <path fill-rule="evenodd" clip-rule="evenodd" d="M405.419 405.419H312.143V778.857H405.419V592.138H685.581V498.862H405.419V405.419Z" fill="black"/>
              </svg>
            </div>
            <p>1. Open the TransGate app</p>
            <p>2. Tap scan button on Home Screen</p>
          </div>          
          <div id="modal-footer">
            <div class="tips">Don’t have the zkPass app yet?</div>
            <div class="grid">      
              <div id="download-ios" class="download-btn" style="border: 1px solid rgb(234, 236, 239)">
                <a href="https://apps.apple.com/us/app/transgate/id1561374855" target="_blank" style="text-decoration: none; ">
                <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M21.7725 18.7033C21.4062 19.5418 20.9727 20.3136 20.4704 21.0232C19.7857 21.9906 19.2251 22.6602 18.7931 23.032C18.1233 23.6424 17.4058 23.955 16.6374 23.9728C16.0857 23.9728 15.4205 23.8172 14.6461 23.5017C13.8692 23.1876 13.1552 23.032 12.5024 23.032C11.8177 23.032 11.0834 23.1876 10.2979 23.5017C9.51127 23.8172 8.87756 23.9816 8.39305 23.9979C7.65619 24.0291 6.92173 23.7076 6.1886 23.032C5.72069 22.6276 5.13542 21.9343 4.43429 20.9521C3.68203 19.9033 3.06358 18.687 2.57906 17.3004C2.06017 15.8026 1.80005 14.3523 1.80005 12.9482C1.80005 11.3398 2.15076 9.95259 2.85324 8.79011C3.40532 7.85636 4.13979 7.11979 5.05903 6.57906C5.97827 6.03834 6.97151 5.76279 8.04114 5.74516C8.62641 5.74516 9.39391 5.92456 10.3477 6.27715C11.2988 6.63091 11.9095 6.81032 12.1772 6.81032C12.3774 6.81032 13.0558 6.60054 14.2058 6.18233C15.2934 5.79449 16.2113 5.63391 16.9633 5.69716C19.0009 5.86012 20.5317 6.6561 21.5497 8.09013C19.7274 9.18432 18.826 10.7169 18.8439 12.6829C18.8603 14.2142 19.4209 15.4886 20.5227 16.5004C21.022 16.97 21.5796 17.333 22.2001 17.5907C22.0655 17.9774 21.9235 18.3477 21.7725 18.7033ZM17.0993 0.480137C17.0993 1.68041 16.6568 2.8011 15.7748 3.8384C14.7104 5.07155 13.4229 5.78412 12.0268 5.67168C12.009 5.52769 11.9987 5.37614 11.9987 5.21688C11.9987 4.06462 12.5049 2.83147 13.4038 1.82321C13.8526 1.3127 14.4234 0.888228 15.1155 0.549615C15.8062 0.216055 16.4595 0.031589 17.0739 0C17.0918 0.160458 17.0993 0.320926 17.0993 0.480121V0.480137Z"
                    fill="#1E2329"
                  ></path>
                </svg>
                <div>Download for iOS</div>
                </a>
              </div>
              <div id="download-android" class="download-btn" style="border: 1px solid rgb(234, 236, 239)">
              <a href="https://play.google.com/store/apps/details?id=com.zkpass.transgate" target="_blank" style="text-decoration: none; ">
                <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M13.5589 11.0874L4.08203 1.59644H4.17441C4.98558 1.59644 5.68614 1.89129 6.81073 2.4993L16.7488 7.88083L13.5589 11.0874Z"
                    fill="#202630"
                  ></path>
                  <path
                    d="M12.6373 12.008L2.90218 21.7203C2.66236 21.3329 2.49658 20.7063 2.49658 19.8034V4.19354C2.49658 3.29078 2.66236 2.66403 2.90218 2.2771L12.6373 12.008Z"
                    fill="#202630"
                  ></path>
                  <path
                    d="M13.5589 12.9124L16.7488 16.1187L6.81073 21.5001C5.68614 22.1083 4.98548 22.4036 4.17441 22.4036H4.08203L13.5589 12.9124Z"
                    fill="#202630"
                  ></path>
                  <path
                    d="M17.9437 8.52563L14.4775 12.0091L17.9437 15.4738L20.0456 14.3309C20.8199 13.9069 22 13.1329 22 12.0091C22 10.8662 20.8199 10.0922 20.0456 9.66821L17.9437 8.52563Z"
                    fill="#202630"
                  ></path>
                </svg>
                <div>Download for Android</div>
                </a>
              </div>
              <div id="download-extension" class="download-btn" style="border: 1px solid rgb(234, 236, 239)">
                <a href="https://chromewebstore.google.com/detail/zkpass-transgate/afkoofjocpbclhnldmmaphappihehpma" target="_blank" style="text-decoration: none; ">
                <svg style="width:24px; height: 24px;" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 48 48" height="48" width="48"><defs><linearGradient id="a" x1="3.2173" y1="15" x2="44.7812" y2="15" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#d93025"/><stop offset="1" stop-color="#ea4335"/></linearGradient><linearGradient id="b" x1="20.7219" y1="47.6791" x2="41.5039" y2="11.6837" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fcc934"/><stop offset="1" stop-color="#fbbc04"/></linearGradient><linearGradient id="c" x1="26.5981" y1="46.5015" x2="5.8161" y2="10.506" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#1e8e3e"/><stop offset="1" stop-color="#34a853"/></linearGradient></defs><circle cx="24" cy="23.9947" r="12" style="fill:#fff"/><path d="M3.2154,36A24,24,0,1,0,12,3.2154,24,24,0,0,0,3.2154,36ZM34.3923,18A12,12,0,1,1,18,13.6077,12,12,0,0,1,34.3923,18Z" style="fill:none"/><path d="M24,12H44.7812a23.9939,23.9939,0,0,0-41.5639.0029L13.6079,30l.0093-.0024A11.9852,11.9852,0,0,1,24,12Z" style="fill:url(#a)"/><circle cx="24" cy="24" r="9.5" style="fill:#1a73e8"/><path d="M34.3913,30.0029,24.0007,48A23.994,23.994,0,0,0,44.78,12.0031H23.9989l-.0025.0093A11.985,11.985,0,0,1,34.3913,30.0029Z" style="fill:url(#b)"/><path d="M13.6086,30.0031,3.218,12.006A23.994,23.994,0,0,0,24.0025,48L34.3931,30.0029l-.0067-.0068a11.9852,11.9852,0,0,1-20.7778.007Z" style="fill:url(#c)"/></svg>
                <div>Download TranGate</div>
                </a>
              </div>
            </div>
          </div>          
        </div>
      </div>
    </div>
`;

export const mobileDialog = `<div>
      <style>
        body {
          background-color: #1e2329;
        }
        #zkpass-modal-wrapper {
          display: block;
          width: 280px;
          min-height: 100px;
          background-color: #ffffff;
          padding: 12px;
          border-radius: 15px;
          font-family: Arial, Helvetica, sans-serif;
          color: #1e2329;
        }
        #modal {
          position: relative;
          width: 260px;
          min-height: 100px;
        }
        #modal .close-icon {
          position: absolute;
          top: 0px;
          right: 6px;
          width: 20px;
          height: 20px;
        }
        .close-icon::before,
        .close-icon::after {
          content: "";
          position: absolute;
          width: 2px;
          height: 20px;
          background-color: #9d9d9d;
          left: 9px;
          top: 0;
        }

        .close-icon::before {
          transform: rotate(45deg);
        }

        .close-icon::after {
          transform: rotate(-45deg);
        }

        .loading-text {
          display: flex;
          align-items: center;
          color: #000000;
        }

        .loader {
          width: 30px;
          height: 30px;
          border: 1px solid;
          border-color: #000000 transparent;
          border-radius: 50%;
          display: inline-block;
          box-sizing: border-box;
          margin-right: 8px;
          animation: rotation 1s linear infinite;
        }

        @keyframes rotation {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }

        #modal-body {
          display: flex;
          align-items: center;
          align-content: center;
          justify-content: center;
          justify-items: center;
          flex-direction: column;
          min-height: 100px;
          p {
            font-size: 14px;
            color: #2c333c;
            margin-bottom: 0;
            margin-top: 20px;            
          }
        }
        #loading-box, #complete-box{
          display: flex;
          align-items: center;
          align-content: center;
          justify-content: center;
          justify-items: center;
          flex-direction: column;
        }
        #complete-box{
          display: none;
        }
        button {
          background-color: #1e2329;
          color: #ffffff;
          border: none;
          border-radius: 5px;
          padding: 8px 16px;
          cursor: pointer;
          font-size: 12px;
          margin-top: 16px;
        }
      </style>
      <div id="zkpass-modal-wrapper">
        <div id="modal">
          <div id="close-transgate" class="close-icon"></div>
          <div id="modal-body">
            <div id="loading-box">
              <div class="loading-text">
                <span class="loader"></span>
              </div>
              <p>Application for validation task</p>
            </div>
            <div id="complete-box">
              <p>Task information preparation complete </p>
              <button id="verify-button">Verify By TransGate Clip</button>
            </div>            
          </div>
        </div>
      </div>
    </div>`;
