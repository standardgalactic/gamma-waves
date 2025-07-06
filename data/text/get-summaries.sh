#!/bin/bash

# Define progress and summary files
progress_file="progress.log"
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
summary_file="memetic-cognition.txt"
=======
summary_file="physics-inoculation-theory.txt"
>>>>>>> ab2fa95 (Macroscale Solutions)
=======
summary_file="memetic-cognition.txt"
>>>>>>> 4533ee7 (Macroscale Solutions)
main_dir=$(pwd)
=======
summary_file="autoregression.txt"
main_dir=$(pwd)
content_file="content.txt"
chunk_size=300
>>>>>>> ba48821 (RSVP Visuals)

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
    
<<<<<<< HEAD
    # Iterate over each .txt file in the specified directory
=======
>>>>>>> ba48821 (RSVP Visuals)
    for file in "$dir"/*.txt; do
        # Skip if no .txt files are found
        if [ ! -e "$file" ]; then
            continue
        fi

<<<<<<< HEAD
        # Skip processing the summary file
        if [ "$(basename "$file")" == "$summary_file" ]; then
            echo "Skipping summary file: $summary_file"
            continue
        fi


        # Process the file if it's a regular file
        if [ -f "$file" ]; then
            local file_name=$(basename "$file")  # Get the file name only
            
            # Process only if not processed before
            if ! is_processed "$file_name"; then
                echo "Processing $file_name"
                echo "Processing $file_name" >> "$main_dir/$progress_file"
=======
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
>>>>>>> ba48821 (RSVP Visuals)

                # Create a temporary directory for the file's chunks
                sanitized_name=$(basename "$file" | tr -d '[:space:]')
                temp_dir=$(mktemp -d "$dir/tmp_${sanitized_name}_XXXXXX")
                echo "Temporary directory created: $temp_dir" >> "$main_dir/$progress_file"

<<<<<<< HEAD
                # Split the file into chunks of 200 lines each
<<<<<<< HEAD
<<<<<<< HEAD
                split -l 100 "$file" "$temp_dir/chunk_"
=======
                split -l 60 "$file" "$temp_dir/chunk_"
>>>>>>> ab2fa95 (Macroscale Solutions)
=======
                split -l 100 "$file" "$temp_dir/chunk_"
>>>>>>> 4533ee7 (Macroscale Solutions)
                echo "File split into chunks: $(find "$temp_dir" -type f)" >> "$main_dir/$progress_file"

                # Summarize each chunk and append to the summary file
                for chunk_file in "$temp_dir"/chunk_*; do
                    [ -f "$chunk_file" ] || continue
                    echo "Summarizing chunk: $(basename "$chunk_file")"
                    ollama run vanilj/phi-4 "Summarize in detail and explain:" < "$chunk_file" | tee -a "$main_dir/$summary_file"
=======
                # Split the file into chunks of $chunk_size lines each
                split -l $chunk_size "$file" "$temp_dir/chunk_"
                echo "File split into chunks: $(find "$temp_dir" -type f)" >> "$main_dir/$progress_file"

                # Summarize each chunk with content.txt appended and append to the summary file
                for chunk_file in "$temp_dir"/chunk_*; do
                    [ -f "$chunk_file" ] || continue
                    echo "Summarizing chunk: $(basename "$chunk_file")"
                    cat "$chunk_file" "$main_dir/$content_file" > "$temp_dir/combined_chunk"
                    ollama run granite3.2:8b "Summarize in detail and explain:" < "$temp_dir/combined_chunk" | tee -a "$main_dir/$summary_file"
>>>>>>> ba48821 (RSVP Visuals)
                    echo "" >> "$main_dir/$summary_file"
                done

                # Remove the temporary directory
                rm -rf "$temp_dir"
                echo "Temporary directory $temp_dir removed" >> "$main_dir/$progress_file"

                # Mark the file as processed
<<<<<<< HEAD
                echo "$file_name" >> "$main_dir/$progress_file"
=======
                echo "$base_file" >> "$main_dir/$progress_file"
>>>>>>> ba48821 (RSVP Visuals)
            fi
        fi
    done
}

# Recursively process subdirectories
process_subdirectories() {
    local parent_dir=$1
<<<<<<< HEAD
    
    # Iterate over all subdirectories
    for dir in "$parent_dir"/*/; do
        if [ -d "$dir" ]; then
            process_files "$dir"  # Process files in the subdirectory
            process_subdirectories "$dir"  # Recursive call for nested subdirectories
=======
    for dir in "$parent_dir"/*/; do
        if [ -d "$dir" ]; then
            process_files "$dir"
            process_subdirectories "$dir"
>>>>>>> ba48821 (RSVP Visuals)
        fi
    done
}

# Main execution
<<<<<<< HEAD
process_files "$main_dir"  # Process files in the main directory
process_subdirectories "$main_dir"  # Process files in subdirectories

# Mark script completion
=======
process_files "$main_dir"
process_subdirectories "$main_dir"

>>>>>>> ba48821 (RSVP Visuals)
echo "Script completed at $(date)" >> "$main_dir/$progress_file"
