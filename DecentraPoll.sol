// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract DecentraPoll {
    address public owner;
    uint public maxPollsPerUser = 5;

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not contract owner");
        _;
    }

    struct Poll {
        string question;
        string[] options;
        uint[] voteCounts;
        address creator;
        bool isActive;
        uint expiry;
        uint createdAt;
        uint totalVotes;
        mapping(address => bool) hasVoted;
        mapping(address => uint) userVotes;
    }

    Poll[] private polls;
    mapping(bytes32 => bool) private questionExists;
    mapping(address => uint[]) private userPolls;
    mapping(address => uint) private pollsCreated;

    event PollCreated(uint pollId, string question);
    event PollClosed(uint pollId);
    event PollDeleted(uint pollId);
    event Voted(uint pollId, uint optionIndex, address voter);

    function createPoll(string memory question, string[] memory options, uint expiry) public {
        require(options.length >= 2, "At least 2 options required");
        require(pollsCreated[msg.sender] < maxPollsPerUser, "Poll limit reached");

        bytes32 questionHash = keccak256(abi.encodePacked(question));
        require(!questionExists[questionHash], "Duplicate question");

        uint[] memory counts = new uint[](options.length);
        Poll storage newPoll = polls.push();
        newPoll.question = question;
        newPoll.options = options;
        newPoll.voteCounts = counts;
        newPoll.creator = msg.sender;
        newPoll.isActive = true;
        newPoll.expiry = block.timestamp + expiry;
        newPoll.createdAt = block.timestamp;

        uint pollId = polls.length - 1;
        userPolls[msg.sender].push(pollId);
        pollsCreated[msg.sender]++;
        questionExists[questionHash] = true;

        emit PollCreated(pollId, question);
    }

    function vote(uint pollId, uint optionIndex) public {
        Poll storage poll = polls[pollId];
        require(poll.isActive, "Poll is not active");
        require(block.timestamp < poll.expiry, "Poll expired");
        require(!poll.hasVoted[msg.sender], "Already voted");
        require(optionIndex < poll.options.length, "Invalid option");

        poll.voteCounts[optionIndex]++;
        poll.hasVoted[msg.sender] = true;
        poll.userVotes[msg.sender] = optionIndex;
        poll.totalVotes++;

        emit Voted(pollId, optionIndex, msg.sender);
    }

    function resetAllPolls() public onlyOwner {
        delete polls;
    }

    function deactivatePoll(uint pollId) public {
        Poll storage poll = polls[pollId];
        require(msg.sender == poll.creator || msg.sender == owner, "Not authorized");
        poll.isActive = false;
        emit PollClosed(pollId);
    }

    function deletePoll(uint pollId) public {
        Poll storage poll = polls[pollId];
        require(msg.sender == poll.creator || msg.sender == owner, "Not authorized");
        delete polls[pollId];
        emit PollDeleted(pollId);
    }

    function editPollOptions(uint pollId, string[] memory newOptions) public {
        Poll storage poll = polls[pollId];
        require(msg.sender == poll.creator, "Only creator can edit");
        require(poll.totalVotes == 0, "Poll already has votes");
        poll.options = newOptions;
        delete poll.voteCounts;
        poll.voteCounts = new uint[](newOptions.length);
    }

    function getPoll(uint pollId) public view returns (
        string memory, string[] memory, uint[] memory, address, bool, uint, uint
    ) {
        Poll storage poll = polls[pollId];
        return (
            poll.question,
            poll.options,
            poll.voteCounts,
            poll.creator,
            poll.isActive,
            poll.expiry,
            poll.createdAt
        );
    }

    function getPollCount() public view returns (uint) {
        return polls.length;
    }

    function getPollsByCreator(address user) public view returns (uint[] memory) {
        return userPolls[user];
    }

    function getUserVote(uint pollId, address user) public view returns (uint) {
        Poll storage poll = polls[pollId];
        require(poll.hasVoted[user], "User hasn't voted");
        return poll.userVotes[user];
    }
}
