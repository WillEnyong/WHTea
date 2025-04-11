import React, { useState, useEffect, useCallback } from 'react';
import { ethers, BrowserProvider, JsonRpcProvider } from 'ethers';
import './App.css';
import tokenCollectorABI from './tokenCollectorABI.json';
import logo from './assets/tea.png'; // Impor logo (ganti dengan nama file logo Anda)

const CONTRACT_ADDRESS = "0xe999e5e18efaf5e70025b1929da7bd87cbbf7087";
const TEA_SEPOLIA_CHAIN_ID = 10218;
const RPC_URLS = [
  "https://tea-sepolia.g.alchemy.com/public",
  //"https://rpc.sepolia.org",
  //"https://rpc2.sepolia.org",
];

const Leaderboard = ({ leaderboard }) => (
  <section className="leaderboard fade-in">
    <h2>Leaderboard</h2>
    <ul>
      {leaderboard.map((player, index) => (
        <li key={index}>
          <span>{player.address.slice(0, 6)}...{player.address.slice(-4)}</span>
          <span>{player.points} points</span>
        </li>
      ))}
    </ul>
  </section>
);

function App() {
  const [account, setAccount] = useState(null);
  const [contract, setContract] = useState(null);
  const [tokens, setTokens] = useState(0);
  const [points, setPoints] = useState(0);
  const [networkError, setNetworkError] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [isConnecting, setIsConnecting] = useState(false);

  const updateStatsAndLeaderboard = useCallback(async () => {
    if (!contract || !account) return;
    try {
      const userTokens = Number(await contract.getTokens(account));
      const userPoints = Number(await contract.getPoints(account));
      setTokens(userTokens);
      setPoints(userPoints);

      const [topPlayers, topPoints] = await contract.getLeaderboard();
      const newLeaderboard = topPlayers.map((addr, index) => ({
        address: addr,
        points: Number(topPoints[index]),
      }));
      setLeaderboard(newLeaderboard);
    } catch (error) {
      console.error('Update failed:', error);
      setNetworkError('Failed to update game state. Please check your network connection or wallet settings.');
    }
  }, [contract, account]);

  const connectWallet = useCallback(async () => {
    setIsConnecting(true);
    setNetworkError(null);
    try {
      let provider;
      let signer;

      if (window.ethereum) {
        provider = new BrowserProvider(window.ethereum);
        const network = await provider.getNetwork();

        if (Number(network.chainId) !== TEA_SEPOLIA_CHAIN_ID) {
          try {
            await window.ethereum.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: `0x${TEA_SEPOLIA_CHAIN_ID.toString(16)}` }],
            });
          } catch (switchError) {
            if (switchError.code === 4902) {
              await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [
                  {
                    chainId: `0x${TEA_SEPOLIA_CHAIN_ID.toString(16)}`,
                    chainName: 'Sepolia Test Network',
                    rpcUrls: RPC_URLS,
                    nativeCurrency: {
                      name: 'Sepolia ETH',
                      symbol: 'ETH',
                      decimals: 18,
                    },
                    blockExplorerUrls: ['https://sepolia.etherscan.io'],
                  },
                ],
              });
            } else {
              throw switchError;
            }
          }
        }

        await window.ethereum.request({ method: 'eth_requestAccounts' });
        signer = await provider.getSigner();
      } else {
        let lastError = null;
        for (const url of RPC_URLS) {
          try {
            provider = new JsonRpcProvider(url);
            await provider.getNetwork();
            break;
          } catch (error) {
            console.error(`RPC ${url} failed:`, error);
            lastError = error;
          }
        }
        if (!provider) {
          throw new Error(`No valid RPC provider available: ${lastError?.message || 'Unknown error'}`);
        }
        throw new Error('MetaMask not detected! Please install MetaMask.');
      }

      const address = await signer.getAddress();
      setAccount(address);
      const collectorContract = new ethers.Contract(CONTRACT_ADDRESS, tokenCollectorABI, signer);
      setContract(collectorContract);

      await updateStatsAndLeaderboard();
    } catch (error) {
      console.error('Wallet connection failed:', error);
      setNetworkError(error.message || 'Failed to connect wallet. Please ensure MetaMask is installed and set to Sepolia.');
    } finally {
      setIsConnecting(false);
    }
  }, [updateStatsAndLeaderboard]);

  useEffect(() => {
    connectWallet();
    if (window.ethereum) {
      window.ethereum.on('chainChanged', () => window.location.reload());
      return () => window.ethereum.removeListener('chainChanged', () => window.location.reload());
    }
  }, [connectWallet]);

  useEffect(() => {
    if (contract && account) {
      const interval = setInterval(() => {
        updateStatsAndLeaderboard().catch((error) => {
          console.error('Periodic update failed:', error);
        });
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [contract, account, updateStatsAndLeaderboard]);

  const disconnectWallet = async () => {
    try {
      if (window.ethereum) {
        await window.ethereum.request({ method: 'wallet_revokePermissions', params: [{ eth_accounts: {} }] });
      }
    } catch (error) {
      console.error('Failed to disconnect MetaMask:', error);
    } finally {
      setAccount(null);
      setContract(null);
      setTokens(0);
      setPoints(0);
      setLeaderboard([]);
      setNetworkError(null);
      window.location.reload();
    }
  };

  const handleCollect = async () => {
    try {
      const tx = await contract.collectToken();
      await tx.wait(1);
      await updateStatsAndLeaderboard();
      alert('Token collected successfully!');
    } catch (error) {
      console.error('Collect failed:', error);
      alert(error.reason || 'Failed to collect token. Please check your network connection.');
    }
  };

  const handleBurn = async () => {
    try {
      const tx = await contract.burnTokens();
      await tx.wait(1);
      await updateStatsAndLeaderboard();
      alert('Tokens burned successfully! You earned 10 points.');
    } catch (error) {
      console.error('Burn failed:', error);
      alert(error.reason || 'Failed to burn tokens. Please check your network connection.');
    }
  };

  if (networkError) {
    return (
      <div className="App">
        <header>
          <div className="logo-container">
            <img src={logo} alt="Token Collector Logo" className="logo" />
          </div>
          <h1>TEA Collect</h1>
        </header>
        <main>
          <p className="error-message">{networkError}</p>
          <button onClick={connectWallet} disabled={isConnecting} className="retry-button">
            {isConnecting ? (
              <span className="loading-spinner"></span>
            ) : (
              'Retry Connection'
            )}
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="App">
      <header>
        <div className="logo-container">
          <img src={logo} alt="Token Collector Logo" className="logo" />
        </div>
        <h1>TEA COLLECT</h1>
        <p className="wallet-info">
          Wallet: {account ? `${account.slice(0, 6)}...${account.slice(-4)}` : 'Not connected'}
          {account ? (
            <button onClick={disconnectWallet} className="disconnect-button">
              <i className="fas fa-sign-out-alt" /> Disconnect
            </button>
          ) : (
            <button onClick={connectWallet} className="connect-button" disabled={isConnecting}>
              <i className="fas fa-wallet" /> {isConnecting ? (
                <span className="loading-spinner"></span>
              ) : (
                'Connect Wallet'
              )}
            </button>
          )}
        </p>
      </header>
      <main>
        {account ? (
          <>
            <section className="stats fade-in">
              <p><i className="fas fa-coins" /> Your Tokens: {tokens}</p>
              <p><i className="fas fa-star" /> Your Points: {points}</p>
              <button onClick={handleCollect} className="collect-button">
                <i className="fas fa-hand-pointer" /> Collect Token
              </button>
              <button
                onClick={handleBurn}
                className="burn-button"
                disabled={tokens < 5}
                title={tokens < 5 ? 'Need 5 tokens to burn!' : ''}
              >
                <i className="fas fa-fire" /> Burn 5 Tokens for 10 Points
              </button>
            </section>
            <Leaderboard leaderboard={leaderboard} />
          </>
        ) : (
          <div className="welcome-message fade-in">
            <h2>Welcome to TEA Collect!</h2>
            <p>Connect your wallet to start collecting tokens.</p>
            <button onClick={connectWallet} className="connect-button" disabled={isConnecting}>
              <i className="fas fa-wallet" /> {isConnecting ? (
                <span className="loading-spinner"></span>
              ) : (
                'Connect Wallet'
              )}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
