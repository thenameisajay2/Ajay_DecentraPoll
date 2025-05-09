import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import './App.css';
import PollDAppABI from './PollDAppABI.json';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const CONTRACT_ADDRESS = "0x8ab90c091e7b9a68e526c8fe826992e7045b9b64";

function App() {
  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [account, setAccount] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const [newPollQuestion, setNewPollQuestion] = useState('');
  const [newPollOptions, setNewPollOptions] = useState(['', '']);
  
  const [leaderboard, setLeaderboard] = useState([]);
  const [activeView, setActiveView] = useState('create'); // 'create', 'polls', 'leaderboard'

  const connectWallet = async () => {
    if (window.ethereum) {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      setAccount(accounts[0]);
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const pollContract = new ethers.Contract(CONTRACT_ADDRESS, PollDAppABI, signer);
      await loadPolls(pollContract, accounts[0]);
    } else {
      toast.error("Please install MetaMask.");
    }
  };

  const loadPolls = async (pollContract, userAddress) => {
    try {
      const count = await pollContract.getPollCount();
      const data = [];
      for (let i = 0; i < count; i++) {
        try {
          const [question, options, voteCounts, creator, isActive, expiry, createdAt] = await pollContract.getPoll(i);
          const totalVotes = voteCounts.reduce((a, b) => a.add(b), ethers.BigNumber.from(0));
          let hasVoted = false;
          let userVote = null;
          try {
            const vote = await pollContract.getUserVote(i, userAddress);
            hasVoted = true;
            userVote = vote.toNumber();
          } catch {}

          data.push({
            id: i,
            question,
            options,
            voteCounts: voteCounts.map(v => v.toNumber()),
            totalVotes: totalVotes.toNumber(),
            creator,
            isActive,
            expiry: expiry.toNumber(),
            createdAt: createdAt.toNumber(),
            hasVoted,
            userVote
          });
        } catch {}
      }
      setPolls(data);
      const sorted = [...data].sort((a, b) => b.totalVotes - a.totalVotes);
      setLeaderboard(sorted);
      setLoading(false);
    } catch (err) {
      console.error(err);
      toast.error("Error loading polls.");
      setLoading(false);
    }
  };

  const createPoll = async (e) => {
    e.preventDefault();
    if (!newPollQuestion || newPollOptions.length < 2) {
      return toast.error("Poll question and at least 2 options are required.");
    }
  
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const pollContract = new ethers.Contract(CONTRACT_ADDRESS, PollDAppABI, signer);
  
      const tx = await pollContract.createPoll(
        newPollQuestion,
        newPollOptions,
        86400 // Default duration: 1 day in seconds
      );
      await tx.wait();
      
      toast.success("Poll created!");
      setNewPollQuestion('');
      setNewPollOptions(['', '']);
      await loadPolls(pollContract, account);
    } catch (err) {
      console.error(err);
      toast.error("Failed to create poll.");
    }
  };

  const vote = async (pollId, optionIndex) => {
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const pollContract = new ethers.Contract(CONTRACT_ADDRESS, PollDAppABI, signer);

      const tx = await pollContract.vote(pollId, optionIndex);
      await tx.wait();

      toast.success("Vote cast!");
      await loadPolls(pollContract, account);
    } catch (err) {
      console.error(err);
      toast.error("Failed to vote.");
    }
  };

  const addOption = () => {
    setNewPollOptions([...newPollOptions, '']);
  };

  const removeOption = (idx) => {
    if (newPollOptions.length <= 2) {
      toast.warning("At least two options are required.");
      return;
    }
    const updated = [...newPollOptions];
    updated.splice(idx, 1);
    setNewPollOptions(updated);
  };

  const updateOption = (idx, value) => {
    const updated = [...newPollOptions];
    updated[idx] = value;
    setNewPollOptions(updated);
  };

  const timeSince = (timestamp) => {
    const seconds = Math.floor(Date.now() / 1000) - timestamp;
    const intervals = [
      { label: 'year', seconds: 31536000 },
      { label: 'month', seconds: 2592000 },
      { label: 'day', seconds: 86400 },
      { label: 'hour', seconds: 3600 },
      { label: 'minute', seconds: 60 },
    ];

    for (const interval of intervals) {
      const count = Math.floor(seconds / interval.seconds);
      if (count > 0) return `${count} ${interval.label}${count !== 1 ? 's' : ''} ago`;
    }

    return 'just now';
  };

  const filteredPolls = polls.filter(p => {
    const matchFilter =
      filter === 'all' ||
      (filter === 'mine' && p.creator.toLowerCase() === account.toLowerCase()) ||
      (filter === 'active' && p.isActive && p.expiry > Date.now() / 1000) ||
      (filter === 'inactive' && (!p.isActive || p.expiry <= Date.now() / 1000));
    const matchSearch = p.question.toLowerCase().includes(searchTerm.toLowerCase());
    return matchFilter && matchSearch;
  });

  return (
    <div className={`App ${darkMode ? 'dark-mode' : ''}`}>
      <header className="App-header">
        <h1>DecentraPoll</h1>
        <div className="controls">
          {account ? <p>Connected: {account.slice(0, 6)}...{account.slice(-4)}</p> : <button onClick={connectWallet}>Connect Wallet</button>}
          <button onClick={() => setDarkMode(!darkMode)}>{darkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}</button>
        </div>
      </header>
      <ToastContainer />

      <main>
        {loading ? <div className="loading">Loading...</div> : (
          <>
            <div className="view-controls">
              <select 
                className="view-toggle" 
                value={activeView}
                onChange={(e) => setActiveView(e.target.value)}
              >
                <option value="create">Create Poll</option>
                <option value="polls">View Polls</option>
                <option value="leaderboard">Leaderboard</option>
              </select>
            </div>

            {activeView === 'create' && (
              <section className="create-poll">
                <h2>Create a Poll</h2>
                <form onSubmit={createPoll}>
                  <div className="form-group">
                    <input type="text" value={newPollQuestion} onChange={(e) => setNewPollQuestion(e.target.value)} placeholder="Poll question" required />
                  </div>
                  
                  {newPollOptions.map((opt, idx) => (
                    <div className="option-row" key={idx}>
                      <input type="text" value={opt} onChange={(e) => updateOption(idx, e.target.value)} placeholder={`Option ${idx + 1}`} required />
                      <button type="button" className="remove-option" onClick={() => removeOption(idx)}>×</button>
                    </div>
                  ))}
                  
                  <div className="form-group">
                    <button type="button" className="add-option" onClick={addOption}>Add Option</button>
                  </div>
                  
                  <div className="form-group">
                  </div>
                  
                  <button type="submit" className="create-button">Create Poll</button>
                </form>
              </section>
            )}

            {activeView === 'polls' && (
              <>
                <div className="filter-bar">
                  <input type="text" placeholder="Search polls..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                  <select onChange={(e) => setFilter(e.target.value)} value={filter}>
                    <option value="all">All</option>
                    <option value="mine">Created by Me</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                <p>Total Polls: {filteredPolls.length}</p>
                <div className="polls-grid">
                  {filteredPolls.map(poll => (
                    <div key={poll.id} className="poll-card">
                      <h3>{poll.question}</h3>
                      <p className="poll-meta">
                        {poll.creator.toLowerCase() === account.toLowerCase() && <strong>[Created by you]</strong>} · {timeSince(poll.createdAt)} · {poll.isActive ? '🟢 Active' : '🔴 Closed'}
                      </p>
                      {poll.options.map((opt, idx) => (
                        <div key={idx} className="option">
                          <div className="option-info">
                            <span>{opt}</span>
                            <span>{poll.voteCounts[idx]} votes</span>
                          </div>
                          <div className="progress-bar">
                            <div className="progress" style={{ width: poll.totalVotes > 0 ? `${(poll.voteCounts[idx] / poll.totalVotes) * 100}%` : '0%' }}></div>
                          </div>
                          {!poll.hasVoted && poll.isActive && poll.expiry > Date.now() / 1000 && (
                            <button className="vote-button" onClick={() => vote(poll.id, idx)}>Vote</button>
                          )}
                          {poll.hasVoted && poll.userVote === idx && (
                            <p className="voted-message">You voted this</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </>
            )}

            {activeView === 'leaderboard' && (
              <section className="leaderboard">
                <h2>Leaderboard</h2>
                <ol>
                  {leaderboard.map((poll, idx) => (
                    <li key={poll.id}><strong>{poll.question}</strong> — {poll.totalVotes} votes</li>
                  ))}
                </ol>
              </section>
            )}
          </>
        )}
      </main>

      <footer>
        <p>DecentraPoll — Built with Ethereum & React</p>
      </footer>
    </div>
  );
}

export default App;