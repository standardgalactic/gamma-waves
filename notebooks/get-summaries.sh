#!/bin/bash

# Define progress and summary files
progress_file="progress.log"
summary_file="curated-content.txt"
main_dir=$(pwd)
content_file="content.txt"
chunk_size=500

# Function to check if a file is already processed
is_processed() {
    grep -Fxq "$1" "$main_dir/$progress_file"
}

# Create progress and summary files if they don't exist
touch "$main_dir/$progress_file"
touch "$main_dir/$summary_file"

# Start logging script progress
echo "Script started at $(date)" >> "$main_dir/$progress_file"
echo "Summaries will be saved to $summary_file" >> "$main_dir/$progress_file"

# Function to process text files in a directory
process_files() {
    local dir=$1
    echo "Processing directory: $dir"
    
    for file in "$dir"/*.txt; do
        # Skip if no .txt files are found
        if [ ! -e "$file" ]; then
            continue
        fi

        # Skip processing the summary file and content.txt
        base_file=$(basename "$file")
        if [ "$base_file" == "$summary_file" ] || [ "$base_file" == "$content_file" ]; then
            echo "Skipping special file: $base_file"
            continue
        fi

        if [ -f "$file" ]; then
            if ! is_processed "$base_file"; then
                echo "Processing $base_file"
                echo "Processing $base_file" >> "$main_dir/$progress_file"

                # Create a temporary directory for the file's chunks
                sanitized_name=$(basename "$file" | tr -d '[:space:]')
                temp_dir=$(mktemp -d "$dir/tmp_${sanitized_name}_XXXXXX")
                echo "Temporary directory created: $temp_dir" >> "$main_dir/$progress_file"

                # Split the file into chunks of $chunk_size lines each
                split -l $chunk_size "$file" "$temp_dir/chunk_"
                echo "File split into chunks: $(find "$temp_dir" -type f)" >> "$main_dir/$progress_file"

                # Summarize each chunk with content.txt appended and append to the summary file
                for chunk_file in "$temp_dir"/chunk_*; do
                    [ -f "$chunk_file" ] || continue
                    echo "Summarizing chunk: $(basename "$chunk_file")"
                    cat "$chunk_file" "$main_dir/$content_file" > "$temp_dir/combined_chunk"
                    ollama run granite3.2:8b "Summarize in detail and explain:" < "$temp_dir/combined_chunk" | tee -a "$main_dir/$summary_file"
                    echo "" >> "$main_dir/$summary_file"
                done

                # Remove the temporary directory
                rm -rf "$temp_dir"
                echo "Temporary directory $temp_dir removed" >> "$main_dir/$progress_file"

                # Mark the file as processed
                echo "$base_file" >> "$main_dir/$progress_file"
            fi
        fi
    done
}

# Recursively process subdirectories
process_subdirectories() {
    local parent_dir=$1
    for dir in "$parent_dir"/*/; do
        if [ -d "$dir" ]; then
            process_files "$dir"
            process_subdirectories "$dir"
        fi
    done
}

# Main execution
process_files "$main_dir"
process_subdirectories "$main_dir"

echo "Script completed at $(date)" >> "$main_dir/$progress_file"
