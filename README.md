# SN AI Dev

**AI-Powered ServiceNow Development Automation Framework**

Automate your ServiceNow development workflow using AI. From requirement to deployment - all automated.

## 🚀 Features

- **Requirement Analysis** - AI analyzes and classifies requirements
- **Spec Generation** - Auto-generate functional specifications
- **Solution Design** - Technical design with artifact planning
- **Task Planning** - Break down into discrete development tasks
- **Code Generation** - Generate Business Rules, Script Includes, Flows, etc.
- **Update Set Management** - Package and deploy to ServiceNow instances
- **Context Gathering** - Analyze existing instance for brownfield development

## 📦 Installation

```bash
# Install dependencies
npm install

# Initialize project (interactive setup)
npm run start init

# Or configure manually - copy .env.example to .env and fill in values
cp .env.example .env
```

## 🔧 Configuration

Edit `.env` file with your ServiceNow instance details:

```env
SN_INSTANCE_URL=https://your-instance.service-now.com
SN_USERNAME=admin
SN_PASSWORD=your-password
SN_SCOPE=x_mycompany_myapp
```

## 💻 Usage

### Full Development Pipeline

```bash
# Interactive mode - enter requirement when prompted
npm run start develop

# With requirement text
npm run start develop -r "Create a business rule that auto-assigns incidents to Network group when category is Network"

# From a requirement file
npm run start develop -f requirements/REQ-001.txt

# With options
npm run start develop -r "Your requirement" --priority high --auto-deploy
```

### Other Commands

```bash
# Test connection to ServiceNow
npm run start connect

# Gather context from instance
npm run start context -t incident,problem,change

# Interactive session
npm run start interactive

# Initialize new project
npm run start init
```

## 📁 Project Structure

```
sn-ai-dev/
├── src/
│   ├── cli.js                 # Command-line interface
│   ├── index.js               # Main exports
│   ├── core/
│   │   ├── sn-client.js       # ServiceNow REST API client
│   │   ├── context-gatherer.js # Instance context gathering
│   │   ├── requirement-analyzer.js # Requirement analysis
│   │   ├── spec-writer.js     # Specification generator
│   │   ├── solution-designer.js # Technical design
│   │   ├── task-planner.js    # Task breakdown
│   │   ├── code-generator.js  # Artifact code generation
│   │   ├── update-set-manager.js # Update set handling
│   │   ├── deployer.js        # Deployment to instances
│   │   └── orchestrator.js    # Main workflow controller
│   └── utils/
│       ├── config.js          # Configuration management
│       └── logger.js          # Logging utilities
├── config/
│   └── default.yaml           # Default configuration
├── output/                    # Generated outputs
│   ├── artifacts/             # Generated code
│   ├── docs/                  # Specs and designs
│   ├── tasks/                 # Task breakdowns
│   └── update_sets/           # Update set XMLs
├── templates/                 # Code templates
├── .env                       # Environment config
└── package.json
```

## 🔄 Pipeline Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    SN AI Dev Pipeline                            │
├─────────────────────────────────────────────────────────────────┤
│  1. Connect to Instance                                          │
│  2. Gather Context (tables, rules, scripts)                      │
│  3. Analyze Requirement                                          │
│  4. Generate Functional Specification                            │
│  5. Design Technical Solution                                    │
│  6. Plan Development Tasks                                       │
│  7. Generate ServiceNow Artifacts                                │
│  8. Create Update Set & Deploy                                   │
│  9. Generate Summary Report                                      │
└─────────────────────────────────────────────────────────────────┘
```

## 🤖 Using with Augment AI

This framework is designed to work with Augment AI for enhanced code generation:

1. Open the project in VS Code with Augment
2. Provide your requirement to Augment
3. Augment will use this framework to generate ServiceNow artifacts
4. Review generated code and deploy

## 📄 License

MIT

